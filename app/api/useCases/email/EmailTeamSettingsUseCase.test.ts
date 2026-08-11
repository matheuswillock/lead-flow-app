import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

const settingsFindUniqueMock = mock(async () => null as Record<string, unknown> | null)
const senderCountMock = mock(async () => 0)
const senderCreateMock = mock(async () => ({
  id: "sender-1",
  name: "Vendas",
  email: "vendas@empresaxyz.com.br",
  replyTo: null,
  isDefault: true,
}))
const senderFindFirstMock = mock(async () => ({
  id: "sender-1",
  name: "Vendas",
  email: "vendas@empresaxyz.com.br",
  replyTo: null,
  isDefault: true,
}))
const senderUpdateMock = mock(async () => ({
  id: "sender-1",
  name: "Vendas",
  email: "vendas@empresaxyz.com.br",
  replyTo: null,
  isDefault: true,
}))
const senderFindManyMock = mock(async () => [
  {
    id: "sender-1",
    name: "Vendas",
    email: "vendas@empresaxyz.com.br",
    replyTo: null,
    isDefault: true,
  },
])
const senderUpdateManyMock = mock(async () => ({ count: 0 }))
const settingsUpsertMock = mock(async () => ({}))

const txMock = {
  emailTeamSender: {
    count: senderCountMock,
    create: senderCreateMock,
    findFirst: senderFindFirstMock,
    findMany: senderFindManyMock,
    update: senderUpdateMock,
    updateMany: senderUpdateManyMock,
  },
  emailTeamSettings: {
    findUnique: settingsFindUniqueMock,
    upsert: settingsUpsertMock,
  },
}

const transactionMock = mock(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock))

const prismaMock = {
  emailTeamSettings: {
    findUnique: settingsFindUniqueMock,
  },
  emailTeamSender: {
    count: senderCountMock,
    create: senderCreateMock,
    findFirst: senderFindFirstMock,
    findMany: senderFindManyMock,
    update: senderUpdateMock,
    updateMany: senderUpdateManyMock,
  },
  $transaction: transactionMock,
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

const { EmailTeamSettingsUseCase } = await import(
  "@/app/api/useCases/email/EmailTeamSettingsUseCase"
)

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
  settingsFindUniqueMock.mockClear()
  senderCountMock.mockClear()
  senderCreateMock.mockClear()
  senderFindFirstMock.mockClear()
  senderUpdateMock.mockClear()
  senderFindManyMock.mockClear()
  senderUpdateManyMock.mockClear()
  settingsUpsertMock.mockClear()
  transactionMock.mockClear()
  transactionMock.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) =>
    fn(txMock)
  )

  senderCountMock.mockResolvedValue(0)
  senderCreateMock.mockResolvedValue({
    id: "sender-1",
    name: "Vendas",
    email: "vendas@empresaxyz.com.br",
    replyTo: null,
    isDefault: true,
  })
  senderFindFirstMock.mockResolvedValue({
    id: "sender-1",
    name: "Vendas",
    email: "vendas@empresaxyz.com.br",
    replyTo: null,
    isDefault: true,
  })
  senderUpdateMock.mockResolvedValue({
    id: "sender-1",
    name: "Vendas",
    email: "vendas@empresaxyz.com.br",
    replyTo: null,
    isDefault: true,
  })
  senderFindManyMock.mockResolvedValue([
    {
      id: "sender-1",
      name: "Vendas",
      email: "vendas@empresaxyz.com.br",
      replyTo: null,
      isDefault: true,
    },
  ])
}

describe("EmailTeamSettingsUseCase createSender/updateSender — domínio send-capable", () => {
  const uc = new EmailTeamSettingsUseCase()

  beforeEach(() => {
    resetMocks()
  })

  describe("createSender", () => {
    it("domínio null + e-mail fora da plataforma → bloqueia", async () => {
      settingsFindUniqueMock.mockResolvedValue({
        resendDomainName: null,
        resendDomainStatus: null,
      })

      const output = await uc.createSender(
        { name: "Bruno", email: "bruno@backstageclub.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toMatch(/domínio/i)
      expect(transactionMock).not.toHaveBeenCalled()
    })

    it("domínio setado com status pending/failed → bloqueia", async () => {
      for (const status of ["pending", "failed"] as const) {
        resetMocks()
        settingsFindUniqueMock.mockResolvedValue({
          resendDomainName: "empresaxyz.com.br",
          resendDomainStatus: status,
        })

        const output = await uc.createSender(
          { name: "Vendas", email: "vendas@empresaxyz.com.br" },
          teamCtx
        )

        expect(output.isValid).toBe(false)
        expect(output.errorMessages[0]).toMatch(/domínio/i)
        expect(transactionMock).not.toHaveBeenCalled()
      }
    })

    it("verified + e-mail no domínio → ok", async () => {
      settingsFindUniqueMock.mockResolvedValue({
        resendDomainName: "empresaxyz.com.br",
        resendDomainStatus: "verified",
      })
      senderCreateMock.mockResolvedValue({
        id: "sender-1",
        name: "Vendas",
        email: "vendas@empresaxyz.com.br",
        replyTo: null,
        isDefault: true,
      })
      senderFindManyMock.mockResolvedValue([
        {
          id: "sender-1",
          name: "Vendas",
          email: "vendas@empresaxyz.com.br",
          replyTo: null,
          isDefault: true,
        },
      ])

      const output = await uc.createSender(
        { name: "Vendas", email: "vendas@empresaxyz.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(transactionMock).toHaveBeenCalled()
    })

    it("e-mail @corretorstudio.com (plataforma) → sempre ok", async () => {
      settingsFindUniqueMock.mockResolvedValue({
        resendDomainName: null,
        resendDomainStatus: null,
      })
      senderCreateMock.mockResolvedValue({
        id: "sender-platform",
        name: "Plataforma",
        email: "contato@corretorstudio.com",
        replyTo: null,
        isDefault: true,
      })
      senderFindManyMock.mockResolvedValue([
        {
          id: "sender-platform",
          name: "Plataforma",
          email: "contato@corretorstudio.com",
          replyTo: null,
          isDefault: true,
        },
      ])

      const output = await uc.createSender(
        { name: "Plataforma", email: "contato@corretorstudio.com" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(transactionMock).toHaveBeenCalled()
    })
  })

  describe("updateSender", () => {
    it("domínio null + e-mail fora da plataforma → bloqueia", async () => {
      settingsFindUniqueMock.mockResolvedValue({
        resendDomainName: null,
        resendDomainStatus: null,
      })

      const output = await uc.updateSender(
        "sender-1",
        { name: "Bruno", email: "bruno@backstageclub.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toMatch(/domínio/i)
      expect(transactionMock).not.toHaveBeenCalled()
    })

    it("domínio setado com status pending/failed → bloqueia", async () => {
      for (const status of ["pending", "failed"] as const) {
        resetMocks()
        settingsFindUniqueMock.mockResolvedValue({
          resendDomainName: "empresaxyz.com.br",
          resendDomainStatus: status,
        })

        const output = await uc.updateSender(
          "sender-1",
          { name: "Vendas", email: "vendas@empresaxyz.com.br" },
          teamCtx
        )

        expect(output.isValid).toBe(false)
        expect(output.errorMessages[0]).toMatch(/domínio/i)
        expect(transactionMock).not.toHaveBeenCalled()
      }
    })

    it("verified + e-mail no domínio → ok", async () => {
      settingsFindUniqueMock.mockResolvedValue({
        resendDomainName: "empresaxyz.com.br",
        resendDomainStatus: "verified",
      })
      senderUpdateMock.mockResolvedValue({
        id: "sender-1",
        name: "Vendas",
        email: "vendas@empresaxyz.com.br",
        replyTo: null,
        isDefault: true,
      })

      const output = await uc.updateSender(
        "sender-1",
        { name: "Vendas", email: "vendas@empresaxyz.com.br" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(transactionMock).toHaveBeenCalled()
    })

    it("e-mail @corretorstudio.com (plataforma) → sempre ok", async () => {
      settingsFindUniqueMock.mockResolvedValue({
        resendDomainName: null,
        resendDomainStatus: null,
      })
      senderUpdateMock.mockResolvedValue({
        id: "sender-1",
        name: "Plataforma",
        email: "contato@corretorstudio.com",
        replyTo: null,
        isDefault: true,
      })
      senderFindManyMock.mockResolvedValue([
        {
          id: "sender-1",
          name: "Plataforma",
          email: "contato@corretorstudio.com",
          replyTo: null,
          isDefault: true,
        },
      ])

      const output = await uc.updateSender(
        "sender-1",
        { name: "Plataforma", email: "contato@corretorstudio.com" },
        teamCtx
      )

      expect(output.isValid).toBe(true)
      expect(transactionMock).toHaveBeenCalled()
    })
  })
})
