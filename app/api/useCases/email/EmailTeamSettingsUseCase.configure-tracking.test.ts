import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type {
  EmailTeamSettingsRecord,
  IEmailTeamSettingsRepository,
} from "@/app/api/infra/data/repositories/emailTeamSettings/IEmailTeamSettingsRepository"
import type { IEmailTeamDomainEventRepository } from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import { assertResend } from "@/lib/email"
import { EmailTeamSettingsUseCase } from "./EmailTeamSettingsUseCase"

/**
 * Gate do click tracking por time (17/09): ligar exige domínio próprio
 * VERIFICADO com o CNAME de Tracking resolvendo; o domínio compartilhado da
 * plataforma nunca liga. `clickTracking` ausente preserva a escolha
 * persistida — a rota antiga descartava o campo, e é exatamente essa regressão
 * que estes testes travam.
 */

type DomainsUpdatePayload = {
  id: string
  openTracking: boolean
  clickTracking: boolean
  trackingSubdomain?: string
}

const VERIFIED_RECORDS = [
  { record: "DKIM", status: "verified" },
  { record: "SPF", status: "verified" },
  { record: "Tracking", status: "verified" },
]

const domainsGetMock = mock(async () => ({
  data: {
    id: "dom-1",
    name: "empresaxyz.com.br",
    status: "verified",
    region: "sa-east-1",
    tracking_subdomain: "links",
    open_tracking: true,
    click_tracking: false,
    records: VERIFIED_RECORDS,
  },
  error: null,
}))
const domainsUpdateMock = mock(async (_payload: DomainsUpdatePayload) => ({
  data: null,
  error: null,
}))

function buildResend(): ReturnType<typeof assertResend> {
  return {
    domains: {
      get: domainsGetMock,
      update: domainsUpdateMock,
    },
  } as unknown as ReturnType<typeof assertResend>
}

function settingsRecord(overrides: Partial<EmailTeamSettingsRecord> = {}): EmailTeamSettingsRecord {
  return {
    resendDomainId: "dom-1",
    resendDomainName: "empresaxyz.com.br",
    resendDomainStatus: "verified",
    resendDomainRegion: "sa-east-1",
    resendOpenTracking: true,
    resendClickTracking: false,
    ...overrides,
  } as EmailTeamSettingsRecord
}

const findSettingsMock = mock(async (): Promise<EmailTeamSettingsRecord | null> =>
  settingsRecord()
)

function buildSettingsRepository(): IEmailTeamSettingsRepository {
  return {
    findSettings: findSettingsMock,
  } as unknown as IEmailTeamSettingsRepository
}

const syncFromResendDomainMock = mock(async () => ({
  status: "verified",
  region: "sa-east-1",
  openTracking: true,
  clickTracking: true,
  trackingSubdomain: "links",
}))

function buildDomainEvents(): IEmailTeamDomainEventRepository {
  return {
    syncFromResendDomain: syncFromResendDomainMock,
    recordEventIfMissing: mock(async () => {}),
  } as unknown as IEmailTeamDomainEventRepository
}

function buildUseCase(): EmailTeamSettingsUseCase {
  return new EmailTeamSettingsUseCase({
    settingsRepo: buildSettingsRepository(),
    resendFactory: buildResend,
    domainEvents: buildDomainEvents(),
    domainExistence: async () => "exists" as const,
    dnsProviderLookupService: { lookupDnsProvider: mock(async () => null) },
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

describe("EmailTeamSettingsUseCase.configureDomainTracking — clique por time", () => {
  beforeEach(() => {
    domainsGetMock.mockClear()
    domainsUpdateMock.mockClear()
    syncFromResendDomainMock.mockClear()
    findSettingsMock.mockClear()
    findSettingsMock.mockImplementation(async () => settingsRecord())
    domainsGetMock.mockImplementation(async () => ({
      data: {
        id: "dom-1",
        name: "empresaxyz.com.br",
        status: "verified",
        region: "sa-east-1",
        tracking_subdomain: "links",
        open_tracking: true,
        click_tracking: false,
        records: VERIFIED_RECORDS,
      },
      error: null,
    }))
  })

  it("liga o clique quando domínio verificado e CNAME de Tracking verificado", async () => {
    const output = await buildUseCase().configureDomainTracking(
      { trackingSubdomain: "links", openTracking: true, clickTracking: true },
      teamCtx
    )

    expect(output.isValid).toBe(true)
    expect(domainsUpdateMock).toHaveBeenCalledTimes(1)
    expect(domainsUpdateMock.mock.calls[0][0]).toMatchObject({
      id: "dom-1",
      openTracking: true,
      clickTracking: true,
    })
  })

  it("recusa ligar o clique com o CNAME de Tracking pendente — bloqueio com aviso", async () => {
    domainsGetMock.mockImplementation(async () => ({
      data: {
        id: "dom-1",
        name: "empresaxyz.com.br",
        status: "verified",
        region: "sa-east-1",
        tracking_subdomain: "links",
        open_tracking: true,
        click_tracking: false,
        records: [
          { record: "DKIM", status: "verified" },
          { record: "SPF", status: "verified" },
          { record: "Tracking", status: "pending" },
        ],
      },
      error: null,
    }))

    const output = await buildUseCase().configureDomainTracking(
      { trackingSubdomain: "links", openTracking: true, clickTracking: true },
      teamCtx
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("Tracking")
    expect(domainsUpdateMock).not.toHaveBeenCalled()
  })

  it("recusa ligar o clique com o domínio ainda não verificado", async () => {
    domainsGetMock.mockImplementation(async () => ({
      data: {
        id: "dom-1",
        name: "empresaxyz.com.br",
        status: "pending",
        region: "sa-east-1",
        tracking_subdomain: "links",
        open_tracking: true,
        click_tracking: false,
        records: VERIFIED_RECORDS,
      },
      error: null,
    }))

    const output = await buildUseCase().configureDomainTracking(
      { trackingSubdomain: "links", openTracking: true, clickTracking: true },
      teamCtx
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("verificado")
    expect(domainsUpdateMock).not.toHaveBeenCalled()
  })

  it("NUNCA liga o clique para domínio da plataforma (guard explícito)", async () => {
    findSettingsMock.mockImplementation(async () =>
      settingsRecord({ resendDomainName: "mail.corretorstudio.com" })
    )

    const output = await buildUseCase().configureDomainTracking(
      { trackingSubdomain: "links", openTracking: true, clickTracking: true },
      teamCtx
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("plataforma")
    expect(domainsUpdateMock).not.toHaveBeenCalled()
  })

  it("clickTracking ausente preserva a escolha persistida do time", async () => {
    findSettingsMock.mockImplementation(async () =>
      settingsRecord({ resendClickTracking: true })
    )

    const output = await buildUseCase().configureDomainTracking(
      { trackingSubdomain: "links", openTracking: true },
      teamCtx
    )

    expect(output.isValid).toBe(true)
    expect(domainsUpdateMock.mock.calls[0][0]).toMatchObject({ clickTracking: true })
  })

  it("desligar o clique não exige gate nenhum", async () => {
    findSettingsMock.mockImplementation(async () =>
      settingsRecord({ resendClickTracking: true, resendDomainStatus: "pending" })
    )
    domainsGetMock.mockImplementation(async () => ({
      data: {
        id: "dom-1",
        name: "empresaxyz.com.br",
        status: "pending",
        region: "sa-east-1",
        tracking_subdomain: "links",
        open_tracking: true,
        click_tracking: true,
        records: [],
      },
      error: null,
    }))

    const output = await buildUseCase().configureDomainTracking(
      { trackingSubdomain: "links", openTracking: true, clickTracking: false },
      teamCtx
    )

    expect(output.isValid).toBe(true)
    expect(domainsUpdateMock.mock.calls[0][0]).toMatchObject({ clickTracking: false })
  })
})
