import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type {
  EmailTeamSettingsRecord,
  EmailTeamSettingsSnapshot,
  IEmailTeamSettingsRepository,
} from "@/app/api/infra/data/repositories/emailTeamSettings/IEmailTeamSettingsRepository"
import type { IEmailTeamDomainEventRepository } from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import { assertResend } from "@/lib/email"
import { EmailTeamSettingsUseCase } from "./EmailTeamSettingsUseCase"

type SaveConnectedDomainArgs = Parameters<IEmailTeamSettingsRepository["saveConnectedDomain"]>
type DomainsCreatePayload = {
  name: string
  openTracking: boolean
  clickTracking: boolean
  trackingSubdomain?: string
}
type DomainsUpdatePayload = {
  id: string
  openTracking: boolean
  clickTracking: boolean
  trackingSubdomain?: string
}
type DomainMutationResult = {
  data: { id: string; name: string; records: never[] } | null
  error: { statusCode: number; message: string; name: string } | null
}

const saveConnectedDomainMock = mock(async (..._args: SaveConnectedDomainArgs) => {})

const domainsCreateMock = mock(async (_payload: DomainsCreatePayload): Promise<DomainMutationResult> => ({
  data: { id: "dom-1", name: "empresaxyz.com.br", records: [] },
  error: null,
}))
const domainsUpdateMock = mock(
  async (_payload: DomainsUpdatePayload): Promise<DomainMutationResult> => ({
    data: null,
    error: null,
  })
)
const domainsRemoveMock = mock(async (): Promise<DomainMutationResult> => ({ data: null, error: null }))

function emptySnapshot(): EmailTeamSettingsSnapshot {
  return { settings: null, senders: [], variables: [] }
}

function buildSettingsRepository(): IEmailTeamSettingsRepository {
  return {
    findSettings: mock(async (): Promise<EmailTeamSettingsRecord | null> => null),
    listSenders: mock(async () => []),
    countSenders: mock(async () => 0),
    findSettingsSnapshot: mock(async () => emptySnapshot()),
    saveDispatchPolicy: mock(async () => emptySnapshot()),
    createSender: mock(async () => {
      throw new Error("não usado")
    }),
    updateSender: mock(async () => null),
    deleteSender: mock(async () => true),
    promoteSenderToDefault: mock(async () => emptySnapshot()),
    saveConnectedDomain: saveConnectedDomainMock,
    clearConnectedDomain: mock(async () => {}),
  } as unknown as IEmailTeamSettingsRepository
}

function buildDomainEvents(): IEmailTeamDomainEventRepository {
  return {
    listEvents: mock(async () => []),
    recordEventIfMissing: mock(async () => {}),
    findTeamByResendDomainId: mock(async () => null),
    updateDomainTracking: mock(async () => {}),
    clearDomainSettings: mock(async () => {}),
    syncFromResendDomain: mock(async () => ({
      status: "pending",
      region: "sa-east-1",
      openTracking: true,
      clickTracking: false,
      trackingSubdomain: "links",
    })),
    listConnectedDomains: mock(async () => []),
  } as unknown as IEmailTeamDomainEventRepository
}

function buildResend(): ReturnType<typeof assertResend> {
  return {
    domains: {
      create: domainsCreateMock,
      update: domainsUpdateMock,
      remove: domainsRemoveMock,
    },
  } as unknown as ReturnType<typeof assertResend>
}

/**
 * `domainExistence` SEMPRE injetado: o default do use case consulta DNS/RDAP
 * reais, e teste unitário não pode depender da rede da máquina.
 */
function buildUseCase(
  domainExistence: (name: string) => Promise<"exists" | "not_registered" | "unknown"> = async () =>
    "exists" as const
): EmailTeamSettingsUseCase {
  return new EmailTeamSettingsUseCase({
    settingsRepo: buildSettingsRepository(),
    resendFactory: buildResend,
    domainEvents: buildDomainEvents(),
    domainExistence,
  })
}

const teamCtx = {
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
} as TeamAccess

describe("EmailTeamSettingsUseCase.connectDomain — resposta honesta de tracking", () => {
  beforeEach(() => {
    saveConnectedDomainMock.mockClear()
    domainsCreateMock.mockClear()
    domainsUpdateMock.mockClear()
    domainsRemoveMock.mockClear()
  })

  /**
   * T-C3.2 — a resposta de sucesso dizia `clickTracking: true` enquanto o banco
   * gravava `false` (C6 da auditoria, `EmailTeamSettingsUseCase:507`). Quem lia
   * a resposta montava relatório em cima de um clique que nunca chegaria.
   */
  it("T-C3.2 — o que a resposta afirma é exatamente o que foi persistido", async () => {
    const output = await buildUseCase().connectDomain("empresaxyz.com.br", teamCtx)

    expect(output.isValid).toBe(true)
    expect(saveConnectedDomainMock).toHaveBeenCalledTimes(1)

    const persisted = saveConnectedDomainMock.mock.calls[0]![1]
    const responded = output.result as { openTracking: boolean; clickTracking: boolean }

    expect(responded.openTracking).toBe(persisted.openTracking)
    expect(responded.clickTracking).toBe(persisted.clickTracking)
    expect(responded.clickTracking).toBe(false)
    expect(responded.openTracking).toBe(true)
  })

  it("T-C3.2b — o que é gravado é o mesmo que foi pedido ao provedor", async () => {
    await buildUseCase().connectDomain("empresaxyz.com.br", teamCtx)

    const created = domainsCreateMock.mock.calls[0]![0]
    const persisted = saveConnectedDomainMock.mock.calls[0]![1]

    expect(created.openTracking).toBe(persisted.openTracking)
    expect(created.clickTracking).toBe(persisted.clickTracking)
  })

  /**
   * Bug de 27/08 (suitseguros.com.br): o `create` já nascia com
   * `trackingSubdomain: "links"` e o update de reforço pedia o MESMO valor, o
   * que o Resend responde com 409. O tratamento apagava o domínio recém-criado
   * e devolvia erro — criação bem-sucedida virava falha destrutiva.
   */
  it("o update de reforço não repete o trackingSubdomain que o create já configurou", async () => {
    await buildUseCase().connectDomain("empresaxyz.com.br", teamCtx)

    expect(domainsCreateMock.mock.calls[0]![0].trackingSubdomain).toBe("links")
    expect(domainsUpdateMock.mock.calls[0]![0]).not.toHaveProperty("trackingSubdomain")
  })

  it("409 de tracking do próprio domínio é sucesso idempotente — não apaga o domínio criado", async () => {
    domainsCreateMock.mockImplementationOnce(async () => ({
      data: { id: "domain-1", name: "suitseguros.com.br", records: [] },
      error: null,
    }))
    domainsUpdateMock.mockImplementationOnce(async () => ({
      data: null,
      error: {
        // Corpo verbatim do log da API do Resend em 27/08.
        name: "validation_error",
        message:
          'A tracking domain with the subdomain "links" already exists for this domain.',
        statusCode: 409,
      },
    }))

    const output = await buildUseCase().connectDomain("suitseguros.com.br", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.errorMessages).toEqual([])
    expect(domainsRemoveMock).not.toHaveBeenCalled()
    expect(saveConnectedDomainMock).toHaveBeenCalledTimes(1)
    expect(saveConnectedDomainMock.mock.calls[0]![1]).toMatchObject({
      domainId: "domain-1",
      domainName: "suitseguros.com.br",
    })
  })

  it("409 de tracking de OUTRO subdomínio continua sendo falha, com limpeza e orientação de suporte", async () => {
    domainsCreateMock.mockImplementationOnce(async () => ({
      data: { id: "domain-2", name: "outrodominio.com.br", records: [] },
      error: null,
    }))
    domainsUpdateMock.mockImplementationOnce(async () => ({
      data: null,
      error: {
        name: "validation_error",
        message:
          'A tracking domain with the subdomain "email" already exists for this domain.',
        statusCode: 409,
      },
    }))

    const output = await buildUseCase().connectDomain("outrodominio.com.br", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("suporte do Corretor Studio")
    expect(output.errorMessages[0]).not.toContain("Escolha outro subdomínio")
    expect(domainsRemoveMock).toHaveBeenCalledWith("domain-2")
    expect(saveConnectedDomainMock).not.toHaveBeenCalled()
  })

  it("falha real no update mantém a limpeza anti-órfão e propaga o erro", async () => {
    domainsCreateMock.mockImplementationOnce(async () => ({
      data: { id: "domain-3", name: "empresaxyz.com.br", records: [] },
      error: null,
    }))
    domainsUpdateMock.mockImplementationOnce(async () => ({
      data: null,
      error: {
        name: "application_error",
        message: "Internal server error",
        statusCode: 500,
      },
    }))

    const output = await buildUseCase().connectDomain("empresaxyz.com.br", teamCtx)

    expect(output.isValid).toBe(false)
    expect(domainsRemoveMock).toHaveBeenCalledWith("domain-3")
    expect(saveConnectedDomainMock).not.toHaveBeenCalled()
  })

  it("sanitiza o domínio antes do POST — protocolo, barra final, espaços e caixa", async () => {
    await buildUseCase().connectDomain("  HTTP://Dominio.COM.br/  ", teamCtx)

    expect(domainsCreateMock.mock.calls[0]![0].name).toBe("dominio.com.br")
  })

  it("recusa entrada que sobra vazia depois da sanitização", async () => {
    const output = await buildUseCase().connectDomain("https:// /", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe("Nome de domínio inválido")
    expect(domainsCreateMock).not.toHaveBeenCalled()
  })

  /**
   * Incidente Gorrilhas (01/09): domínio digitado errado/não registrado só
   * aparecia como "Falhou" dias depois, na verificação assíncrona de DNS. A
   * recusa tem que acontecer no submit, ANTES de criar o domínio no provedor.
   */
  it("domínio não registrado é recusado no submit, sem tocar o provedor", async () => {
    const output = await buildUseCase(async () => "not_registered").connectDomain(
      "naoexiste-xyz.com.br",
      teamCtx
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(
      'O domínio "naoexiste-xyz.com.br" não existe ou ainda não foi registrado. Confira a grafia — o domínio precisa estar registrado antes de ser conectado.'
    )
    expect(domainsCreateMock).not.toHaveBeenCalled()
    expect(saveConnectedDomainMock).not.toHaveBeenCalled()
  })

  it("a checagem de existência recebe o domínio JÁ sanitizado", async () => {
    const consulted: string[] = []
    await buildUseCase(async (name) => {
      consulted.push(name)
      return "exists"
    }).connectDomain("  HTTP://Empresa.COM.br/  ", teamCtx)

    expect(consulted).toEqual(["empresa.com.br"])
  })

  it("resolver indisponível (unknown) não bloqueia a conexão — fail-open", async () => {
    const output = await buildUseCase(async () => "unknown").connectDomain(
      "empresaxyz.com.br",
      teamCtx
    )

    expect(output.isValid).toBe(true)
    expect(domainsCreateMock).toHaveBeenCalledTimes(1)
  })
})
