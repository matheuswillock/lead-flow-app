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

const saveConnectedDomainMock = mock(async (..._args: SaveConnectedDomainArgs) => {})
type DomainsCreatePayload = { openTracking: boolean; clickTracking: boolean }

const domainsCreateMock = mock(async (_payload: DomainsCreatePayload) => ({
  data: { id: "dom-1", name: "empresaxyz.com.br", records: [] },
  error: null,
}))
const domainsUpdateMock = mock(async () => ({ data: null, error: null }))

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
    domains: { create: domainsCreateMock, update: domainsUpdateMock },
  } as unknown as ReturnType<typeof assertResend>
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
  })

  /**
   * T-C3.2 — a resposta de sucesso dizia `clickTracking: true` enquanto o banco
   * gravava `false` (C6 da auditoria, `EmailTeamSettingsUseCase:507`). Quem lia
   * a resposta montava relatório em cima de um clique que nunca chegaria.
   */
  it("T-C3.2 — o que a resposta afirma é exatamente o que foi persistido", async () => {
    const useCase = new EmailTeamSettingsUseCase({
      settingsRepo: buildSettingsRepository(),
      resendFactory: buildResend,
      domainEvents: buildDomainEvents(),
    })

    const output = await useCase.connectDomain("empresaxyz.com.br", teamCtx)

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
    const useCase = new EmailTeamSettingsUseCase({
      settingsRepo: buildSettingsRepository(),
      resendFactory: buildResend,
      domainEvents: buildDomainEvents(),
    })

    await useCase.connectDomain("empresaxyz.com.br", teamCtx)

    const created = domainsCreateMock.mock.calls[0]![0]
    const persisted = saveConnectedDomainMock.mock.calls[0]![1]

    expect(created.openTracking).toBe(persisted.openTracking)
    expect(created.clickTracking).toBe(persisted.clickTracking)
  })
})
