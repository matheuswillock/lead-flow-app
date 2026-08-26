import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type {
  EmailTeamSenderRecord,
  EmailTeamSettingsRecord,
  EmailTeamSettingsSnapshot,
  IEmailTeamSettingsRepository,
} from "@/app/api/infra/data/repositories/emailTeamSettings/IEmailTeamSettingsRepository"
import { EmailTeamSettingsUseCase } from "./EmailTeamSettingsUseCase"

const DEFAULT_SENDER: EmailTeamSenderRecord = {
  id: "sender-1",
  name: "Vendas",
  email: "vendas@empresaxyz.com.br",
  replyTo: null,
  isDefault: true,
}

function settingsRecord(
  overrides: Partial<EmailTeamSettingsRecord> = {}
): EmailTeamSettingsRecord {
  return {
    fromName: "Corretor Studio",
    fromEmail: "contato@corretorstudio.com",
    replyTo: null,
    dispatchBlockedDates: null,
    dispatchTimeFrom: null,
    dispatchTimeTo: null,
    dispatchAllowedRoles: ["manager", "backoffice"],
    templateCreateRoles: ["manager", "backoffice"],
    templateApprovalRequired: false,
    templateApprovalRoles: ["manager", "backoffice"],
    blockedDispatchDays: [],
    resendDomainId: null,
    resendDomainName: null,
    resendDomainStatus: null,
    resendDomainRegion: null,
    resendDomainConnectedAt: null,
    resendOpenTracking: false,
    resendClickTracking: false,
    ...overrides,
  }
}

function emptySnapshot(): EmailTeamSettingsSnapshot {
  return { settings: null, senders: [], variables: [] }
}

const findSettingsMock = mock(async (): Promise<EmailTeamSettingsRecord | null> => null)
const createSenderMock = mock(async (): Promise<EmailTeamSenderRecord> => DEFAULT_SENDER)
const updateSenderMock = mock(async (): Promise<EmailTeamSenderRecord | null> => DEFAULT_SENDER)
const deleteSenderMock = mock(async (): Promise<boolean> => true)
const promoteSenderToDefaultMock = mock(
  async (): Promise<EmailTeamSettingsSnapshot | null> => emptySnapshot()
)

/**
 * Fake do repositório injetado no construtor. Substitui o antigo `mock.module`
 * do Prisma: o UseCase não conhece mais o client, então não há o que interceptar
 * no nível de módulo.
 */
function buildSettingsRepository(): IEmailTeamSettingsRepository {
  return {
    findSettings: findSettingsMock,
    listSenders: mock(async () => []),
    countSenders: mock(async () => 0),
    findSettingsSnapshot: mock(async () => emptySnapshot()),
    saveDispatchPolicy: mock(async () => emptySnapshot()),
    createSender: createSenderMock,
    updateSender: updateSenderMock,
    deleteSender: deleteSenderMock,
    promoteSenderToDefault: promoteSenderToDefaultMock,
    saveConnectedDomain: mock(async () => {}),
    clearConnectedDomain: mock(async () => {}),
  }
}

const teamCtx: TeamAccess = {
  supabaseId: "supa-1",
  teamId: "team-1",
  profileId: "profile-1",
  profileEmail: "test@test.com",
  profileName: "Test User",
  isMaster: false,
  managerId: "manager-1",
  canCreateAccountUsers: false,
  canManageAccountTeams: false,
  canTransferAccountLeads: false,
  canViewAllTeams: false,
  userTimezone: "America/Sao_Paulo",
  teamMember: { role: "manager", functions: [] },
}

function resetMocks() {
  findSettingsMock.mockClear()
  createSenderMock.mockClear()
  updateSenderMock.mockClear()
  deleteSenderMock.mockClear()
  promoteSenderToDefaultMock.mockClear()

  findSettingsMock.mockResolvedValue(null)
  createSenderMock.mockResolvedValue(DEFAULT_SENDER)
  updateSenderMock.mockResolvedValue(DEFAULT_SENDER)
  deleteSenderMock.mockResolvedValue(true)
  promoteSenderToDefaultMock.mockResolvedValue(emptySnapshot())
}

describe("EmailTeamSettingsUseCase createSender/updateSender — domínio send-capable", () => {
  const uc = new EmailTeamSettingsUseCase(buildSettingsRepository())

  beforeEach(() => {
    resetMocks()
  })

  describe("createSender", () => {
    it("domínio null + e-mail fora da plataforma → bloqueia", async () => {
      findSettingsMock.mockResolvedValue(settingsRecord())

      const output = await uc.createSender(
        { name: "Bruno", email: "bruno@backstageclub.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toMatch(/domínio/i)
      // Asserção de ORDEM: a guarda precisa bloquear ANTES de qualquer escrita.
      expect(createSenderMock).not.toHaveBeenCalled()
    })

    it("domínio setado com status pending/failed → bloqueia", async () => {
      for (const status of ["pending", "failed"] as const) {
        resetMocks()
        findSettingsMock.mockResolvedValue(
          settingsRecord({
            resendDomainName: "empresaxyz.com.br",
            resendDomainStatus: status,
          })
        )

        const output = await uc.createSender(
          { name: "Vendas", email: "vendas@empresaxyz.com.br" },
          teamCtx
        )

        expect(output.isValid).toBe(false)
        expect(output.errorMessages[0]).toMatch(/domínio/i)
        expect(createSenderMock).not.toHaveBeenCalled()
      }
    })

    it("verified + e-mail no domínio → ok", async () => {
      findSettingsMock.mockResolvedValue(
        settingsRecord({
          resendDomainName: "empresaxyz.com.br",
          resendDomainStatus: "verified",
        })
      )

      const output = await uc.createSender(
        { name: "Vendas", email: "vendas@empresaxyz.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(createSenderMock).toHaveBeenCalled()
    })

    it("verified + domínio mail e e-mail no domínio raiz → ok", async () => {
      findSettingsMock.mockResolvedValue(
        settingsRecord({
          resendDomainName: "mail.libercorretora.com.br",
          resendDomainStatus: "verified",
        })
      )

      const output = await uc.createSender(
        { name: "Alexandre", email: "alexandre@libercorretora.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(createSenderMock).toHaveBeenCalled()
    })

    it("verified + domínio raiz e e-mail com prefixo mail → ok", async () => {
      findSettingsMock.mockResolvedValue(
        settingsRecord({
          resendDomainName: "libercorretora.com.br",
          resendDomainStatus: "verified",
        })
      )

      const output = await uc.createSender(
        { name: "Alexandre", email: "alexandre@mail.libercorretora.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(createSenderMock).toHaveBeenCalled()
    })

    it("verified + domínio mail e e-mail em outro subdomínio raiz → bloqueia", async () => {
      findSettingsMock.mockResolvedValue(
        settingsRecord({
          resendDomainName: "mail.libercorretora.com.br",
          resendDomainStatus: "verified",
        })
      )

      const output = await uc.createSender(
        { name: "Alexandre", email: "alexandre@app.libercorretora.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toContain("@mail.libercorretora.com.br")
      expect(createSenderMock).not.toHaveBeenCalled()
    })

    it("e-mail @corretorstudio.com (plataforma) → sempre ok", async () => {
      findSettingsMock.mockResolvedValue(settingsRecord())
      createSenderMock.mockResolvedValue({
        id: "sender-platform",
        name: "Plataforma",
        email: "contato@corretorstudio.com",
        replyTo: null,
        isDefault: true,
      })

      const output = await uc.createSender(
        { name: "Plataforma", email: "contato@corretorstudio.com" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(createSenderMock).toHaveBeenCalled()
    })
  })

  describe("updateSender", () => {
    it("domínio null + e-mail fora da plataforma → bloqueia", async () => {
      findSettingsMock.mockResolvedValue(settingsRecord())

      const output = await uc.updateSender(
        "sender-1",
        { name: "Bruno", email: "bruno@backstageclub.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toMatch(/domínio/i)
      expect(updateSenderMock).not.toHaveBeenCalled()
    })

    it("domínio setado com status pending/failed → bloqueia", async () => {
      for (const status of ["pending", "failed"] as const) {
        resetMocks()
        findSettingsMock.mockResolvedValue(
          settingsRecord({
            resendDomainName: "empresaxyz.com.br",
            resendDomainStatus: status,
          })
        )

        const output = await uc.updateSender(
          "sender-1",
          { name: "Vendas", email: "vendas@empresaxyz.com.br" },
          teamCtx
        )

        expect(output.isValid).toBe(false)
        expect(output.errorMessages[0]).toMatch(/domínio/i)
        expect(updateSenderMock).not.toHaveBeenCalled()
      }
    })

    it("verified + e-mail no domínio → ok", async () => {
      findSettingsMock.mockResolvedValue(
        settingsRecord({
          resendDomainName: "empresaxyz.com.br",
          resendDomainStatus: "verified",
        })
      )

      const output = await uc.updateSender(
        "sender-1",
        { name: "Vendas", email: "vendas@empresaxyz.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(updateSenderMock).toHaveBeenCalled()
    })

    it("verified + domínio mail e e-mail no domínio raiz → ok", async () => {
      findSettingsMock.mockResolvedValue(
        settingsRecord({
          resendDomainName: "mail.libercorretora.com.br",
          resendDomainStatus: "verified",
        })
      )

      const output = await uc.updateSender(
        "sender-1",
        { name: "Alexandre", email: "alexandre@libercorretora.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(updateSenderMock).toHaveBeenCalled()
    })

    it("verified + domínio raiz e e-mail com prefixo mail → ok", async () => {
      findSettingsMock.mockResolvedValue(
        settingsRecord({
          resendDomainName: "libercorretora.com.br",
          resendDomainStatus: "verified",
        })
      )

      const output = await uc.updateSender(
        "sender-1",
        { name: "Alexandre", email: "alexandre@mail.libercorretora.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(updateSenderMock).toHaveBeenCalled()
    })

    it("e-mail @corretorstudio.com (plataforma) → sempre ok", async () => {
      findSettingsMock.mockResolvedValue(settingsRecord())
      updateSenderMock.mockResolvedValue({
        id: "sender-1",
        name: "Plataforma",
        email: "contato@corretorstudio.com",
        replyTo: null,
        isDefault: true,
      })

      const output = await uc.updateSender(
        "sender-1",
        { name: "Plataforma", email: "contato@corretorstudio.com" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(updateSenderMock).toHaveBeenCalled()
    })
  })
})

/**
 * O repositório sinaliza "remetente inexistente neste time" por valor de retorno
 * (null/false), e não mais por `throw new Error("NOT_FOUND")`. Estes testes
 * travam essa tradução: um retorno vazio interpretado como sucesso devolveria
 * Output válido com `result` nulo e a UI removeria o remetente da tela sem que
 * nada tivesse acontecido no banco.
 */
describe("EmailTeamSettingsUseCase — remetente inexistente", () => {
  const uc = new EmailTeamSettingsUseCase(buildSettingsRepository())

  beforeEach(() => {
    resetMocks()
  })

  it("updateSender com id de outro time → 'Remetente não encontrado'", async () => {
    findSettingsMock.mockResolvedValue(settingsRecord())
    updateSenderMock.mockResolvedValue(null)

    const output = await uc.updateSender(
      "sender-de-outro-time",
      { name: "Plataforma", email: "contato@corretorstudio.com" },
      teamCtx
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe("Remetente não encontrado")
  })

  it("deleteSender com id de outro time → 'Remetente não encontrado'", async () => {
    deleteSenderMock.mockResolvedValue(false)

    const output = await uc.deleteSender("sender-de-outro-time", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe("Remetente não encontrado")
  })

  it("setDefaultSender com id de outro time → 'Remetente não encontrado'", async () => {
    promoteSenderToDefaultMock.mockResolvedValue(null)

    const output = await uc.setDefaultSender("sender-de-outro-time", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe("Remetente não encontrado")
  })
})
