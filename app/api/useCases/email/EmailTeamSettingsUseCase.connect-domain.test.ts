import { describe, expect, it, mock } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type {
  EmailTeamSettingsRecord,
  EmailTeamSettingsSnapshot,
  IEmailTeamSettingsRepository,
} from "@/app/api/infra/data/repositories/emailTeamSettings/IEmailTeamSettingsRepository"

const resendCreateDomainMock = mock(async () => ({
  data: {
    id: "domain-1",
    name: "onsidemarketing.com.br",
    records: [],
  },
  error: null,
}))

const resendUpdateDomainMock = mock(async () => ({
  data: null,
  error: {
    statusCode: 409,
    message:
      'A tracking domain with the subdomain "links" already exists for this domain.',
    name: "validation_error",
  },
}))

const resendRemoveDomainMock = mock(async () => ({
  data: null,
  error: null,
}))

mock.module("@/lib/email", () => ({
  assertResend: () => ({
    domains: {
      create: resendCreateDomainMock,
      update: resendUpdateDomainMock,
      remove: resendRemoveDomainMock,
    },
  }),
}))

mock.module("@/app/api/infra/data/repositories/emailTeamSettings/EmailTeamSettingsRepository", () => ({
  emailTeamSettingsRepository: {},
}))

mock.module("@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository", () => ({
  emailTeamDomainEventRepository: {
    listEvents: mock(async () => []),
    recordEventIfMissing: mock(async () => {}),
  },
}))

const { EmailTeamSettingsUseCase } = await import("./EmailTeamSettingsUseCase")

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
      throw new Error("not used")
    }),
    updateSender: mock(async () => {
      throw new Error("not used")
    }),
    deleteSender: mock(async () => true),
    promoteSenderToDefault: mock(async () => emptySnapshot()),
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

describe("EmailTeamSettingsUseCase connectDomain — tracking conflict", () => {
  it("retorna mensagem específica quando o subdomínio de tracking já existe no Resend", async () => {
    const uc = new EmailTeamSettingsUseCase(buildSettingsRepository())

    const output = await uc.connectDomain("onsidemarketing.com.br", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(
      "Este subdomínio de tracking já está em uso no Resend. Escolha outro subdomínio ou use o que já está vinculado a este domínio."
    )
    expect(output.errorMessages[0]).not.toContain("domínio já está cadastrado")
    expect(resendRemoveDomainMock).toHaveBeenCalledWith("domain-1")
  })
})
