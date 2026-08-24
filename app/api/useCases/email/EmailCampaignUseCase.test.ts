import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { SuppressedAudienceCounts } from "@/app/api/infra/data/repositories/emailCampaignRecipient/IEmailCampaignRecipientRepository"

const EMPTY_SUPPRESSED_COUNTS: SuppressedAudienceCounts = {
  bounced: 0,
  unsubscribed: 0,
  complained: 0,
  total: 0,
}

// =============================================================================
// MOCKS — declarar ANTES de qualquer await import()
// =============================================================================

// --- EmailCampaignRecipientRepository (dynamic import in previewPlan) ---
const countSuppressedRecipientsForListsMock = mock(async () => EMPTY_SUPPRESSED_COUNTS)
const countSuppressedRecipientsForEmailsMock = mock(async () => EMPTY_SUPPRESSED_COUNTS)
mock.module(
  "@/app/api/infra/data/repositories/emailCampaignRecipient/EmailCampaignRecipientRepository",
  () => ({
    emailCampaignRecipientRepository: {
      countSuppressedRecipientsForLists: countSuppressedRecipientsForListsMock,
      countSuppressedRecipientsForEmails: countSuppressedRecipientsForEmailsMock,
    },
  })
)

// --- EmailCampaignDispatchService ---
const dispatchBatchMock = mock(async (_params: unknown) => ({
  sent: 0,
  failed: 0,
  dispatched: [] as Array<{ email: string; resendId: string }>,
  providerErrors: [] as Array<{ message: string; emails: string[]; statusCode?: number }>,
}))
mock.module("@/app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService", () => ({
  EmailCampaignDispatchService: class {
    dispatchBatch = dispatchBatchMock
  },
}))

// --- EmailCampaignRecipientService ---
const buildCampaignDispatchInputMock = mock(async () => makeDefaultDispatchInput([]))
const findUnresolvedTokensMock = mock(() => [] as string[])
const listActiveRecipientsMock = mock(
  async (..._args: unknown[]) => [] as Array<{ email: string; name: string; contactId: string }>
)
mock.module("@/lib/radar/enrich-campaign-recipients", () => ({
  enrichCampaignRecipientsWithRadar: async (_teamId: string, recipients: unknown) => recipients,
}))

mock.module("@/app/api/services/EmailCampaignDispatch/EmailCampaignRecipientService", () => ({
  EmailCampaignRecipientService: class {
    buildCampaignDispatchInput = buildCampaignDispatchInputMock
    findUnresolvedTokensForRecipients = findUnresolvedTokensMock
    listActiveRecipients = async (...args: unknown[]) => {
      const listed = await listActiveRecipientsMock(...args)
      const page = args[2] as { skip: number; take: number } | undefined
      const built = await buildCampaignDispatchInputMock()
      const source =
        listed.length > 0 ? listed : (built.recipients ?? [])
      if (page) return source.slice(page.skip, page.skip + page.take)
      return source
    }
    listActiveRecipientsByIds = async (ids: string[]) => {
      const listed = await listActiveRecipientsMock()
      const source =
        listed.length > 0 ? listed : ((await buildCampaignDispatchInputMock()).recipients ?? [])
      if (ids.length === 0) return source
      const matched = source.filter(
        (recipient: { contactId?: string | null }) =>
          Boolean(recipient.contactId) && ids.includes(recipient.contactId as string)
      )
      return matched.length > 0 ? matched : source
    }
    countActiveRecipients = async (...args: unknown[]) =>
      (await listActiveRecipientsMock(...args)).length ||
      ((await buildCampaignDispatchInputMock()).recipients?.length ?? 0)
    getGlobalDefaults = async () => ({})
    parseTemplateVariables = (variables: unknown) => (Array.isArray(variables) ? variables : [])
  },
}))

// --- EmailCreditService ---
const reserveCreditsMock = mock(async () => ({ ok: true as const } as { ok: true } | { ok: false; reason: string; available: number }))
const releaseCreditsMock = mock(async () => {})
const formatInsufficientMock = mock((_n: number, _a: number) => "Saldo insuficiente de e-mails")
mock.module("@/app/api/services/EmailCredit/EmailCreditService", () => ({
  EmailCreditService: class {
    reserveCredits = reserveCreditsMock
    releaseCredits = releaseCreditsMock
    formatInsufficientCreditsMessage = formatInsufficientMock
  },
  emailCreditService: {
    reserveCredits: reserveCreditsMock,
    releaseCredits: releaseCreditsMock,
    formatInsufficientCreditsMessage: formatInsufficientMock,
  },
}))

// --- TeamEmailDispatchLogger ---
const createQueuedLogsMock = mock(async (inputs: Array<{ recipientEmail: string }>) =>
  inputs.map((i) => ({ email: i.recipientEmail, logId: `log-${i.recipientEmail}` }))
)
const markManyTeamEmailLogsSentMock = mock(async (_entries: Array<{ logId: string }>) => {})
const markTeamEmailLogFailedMock = mock(async (_logId: string) => {})
mock.module("@/lib/email/team-email-dispatch-logger", () => ({
  teamEmailDispatchLogger: {
    createQueuedTeamEmailLogs: createQueuedLogsMock,
    markManyTeamEmailLogsSent: markManyTeamEmailLogsSentMock,
    markTeamEmailLogFailed: markTeamEmailLogFailedMock,
  },
}))

// --- Prisma ---
const emailCampaignFindFirstMock = mock(async (..._args: unknown[]) => makeCampaign() as unknown)
const emailCampaignFindUniqueMock = mock(async (..._args: unknown[]) => ({
  name: "Campanha Teste",
  parentCampaignId: null as string | null,
}))
const emailCampaignDispatchFindUniqueMock = mock(async (..._args: unknown[]) => ({
  triggeredBy: "profile-1",
  status: "sending" as const,
}))
const emailCampaignFindManyMock = mock(async (..._args: unknown[]) => [] as unknown[])
const emailCampaignCountMock = mock(async () => 0)
const emailCampaignGroupByMock = mock(async (..._args: unknown[]) => [] as unknown[])
const emailCampaignUpdateManyMock = mock(async (..._args: unknown[]) => ({ count: 1 }))
const emailCampaignUpdateMock = mock(async () => ({ parentCampaignId: null as string | null }))
const emailTemplateFindFirstMock = mock(async () => null as unknown)
const emailCampaignDispatchAggregateMock = mock(async () => ({ _max: { dispatchNumber: 0 } }))
const emailCampaignDispatchCreateMock = mock(async (..._args: unknown[]) => ({ id: "dispatch-1" }))
const emailCampaignDispatchFindFirstMock = mock(async () => ({ id: "dispatch-1" }))
const emailCampaignDispatchFindManyMock = mock(async (..._args: unknown[]) => [] as unknown[])
const emailCampaignDispatchUpdateMock = mock(async () => ({}))
const emailCampaignDispatchUpdateManyMock = mock(async (..._args: unknown[]) => ({ count: 0 }))
const emailTeamSenderFindFirstMock = mock(async () => null as { name: string; email: string } | null)
const emailLogFindManyMock = mock(async (..._args: unknown[]) => [] as Array<{
  dispatchId?: string | null
  recipientEmail?: string
  status: string
  sentAt?: Date | null
  resendEmailId?: string | null
}>)
const queryRawMock = mock(async (..._args: unknown[]) => [] as Array<{
  dispatchId: string
  acceptedCount: number
  failedCount: number
  queuedCount: number
}>)
const queryRawUnsafeMock = mock(async () => [{ acquired: true }] as Array<{ acquired: boolean }>)
const emailLogCountMock = mock(async (..._args: unknown[]) => 0)
const emailLogGroupByMock = mock(async (..._args: unknown[]) => [] as Array<{ campaignId: string | null }>)
const profileFindManyMock = mock(async (..._args: unknown[]) => [] as unknown[])
const transactionMock = mock(async (ops: Promise<unknown>[]) => Promise.all(ops))
const emailTeamSettingsFindUniqueMock = mock(async (): Promise<unknown> => null)
const prismaMock = {
  emailCampaign: {
    findFirst: emailCampaignFindFirstMock,
    findUnique: emailCampaignFindUniqueMock,
    findMany: emailCampaignFindManyMock,
    count: emailCampaignCountMock,
    groupBy: emailCampaignGroupByMock,
    updateMany: emailCampaignUpdateManyMock,
    update: emailCampaignUpdateMock,
  },
  emailTeamSettings: { findUnique: emailTeamSettingsFindUniqueMock },
  emailTemplate: { findFirst: emailTemplateFindFirstMock, findMany: mock(async () => []) },
  emailContactList: {
    findMany: mock(async () => [
      { id: "00000000-0000-4000-8000-000000000001", name: "Lista 1" },
    ]),
  },
  emailContact: {
    findMany: mock(async () => []),
  },
  emailCampaignDispatch: {
    aggregate: emailCampaignDispatchAggregateMock,
    create: emailCampaignDispatchCreateMock,
    findFirst: emailCampaignDispatchFindFirstMock,
    findUnique: emailCampaignDispatchFindUniqueMock,
    findMany: emailCampaignDispatchFindManyMock,
    update: emailCampaignDispatchUpdateMock,
    updateMany: emailCampaignDispatchUpdateManyMock,
  },
  emailTeamSender: {
    findFirst: emailTeamSenderFindFirstMock,
  },
  emailLog: {
    findMany: emailLogFindManyMock,
    count: emailLogCountMock,
    groupBy: emailLogGroupByMock,
  },
  profile: {
    findMany: profileFindManyMock,
  },
  backofficeTeamEmailLimitGrant: {
    findUnique: mock(async () => null),
  },
  teamEmailCampaignLimitGrant: {
    findUnique: mock(async () => null),
  },
  $transaction: transactionMock,
  $queryRaw: queryRawMock,
  $queryRawUnsafe: queryRawUnsafeMock,
}
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
  getEmailCronPrisma: () => prismaMock,
  // RadarRepository (pulled via list-segment-recipients) imports withPrismaRetry.
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

// --- Sentry (recoverStuckSendingCampaigns alerta em stuck-sending genuíno) ---
const captureMessageMock = mock((..._args: unknown[]) => {})
mock.module("@sentry/nextjs", () => ({
  withScope: (
    fn: (scope: {
      setTag: (key: string, value: string) => void
      setContext: (key: string, context: Record<string, unknown>) => void
    }) => void
  ) => {
    fn({ setTag: () => {}, setContext: () => {} })
  },
  captureMessage: captureMessageMock,
}))

// --- FeatureAccessService ---
const resolveEmailBetaAccessMock = mock(async () => false)
const resolveRadarBetaAccessMock = mock(async () => true)
mock.module("@/app/api/services/featureAccess/FeatureAccessService", () => ({
  featureAccessService: {
    resolveEmailBetaAccess: resolveEmailBetaAccessMock,
    resolveRadarBetaAccess: resolveRadarBetaAccessMock,
  },
}))

// --- EmailOrphanEventService ---
const processPendingBatchMock = mock(async () => ({ processed: 0, failed: 0, skipped: 0 }))
mock.module("@/app/api/services/resend/EmailOrphanEventService", () => ({
  emailOrphanEventService: { processPendingBatch: processPendingBatchMock },
}))

// --- EmailCampaignLeadActivityService (fire-and-forget) ---
mock.module("@/app/api/services/email/EmailCampaignLeadActivityService", () => ({
  emailCampaignLeadActivityService: { recordDispatchForRecipient: mock(async () => {}) },
}))

// --- Pure helpers ---
mock.module("@/lib/email/inline-email-html", () => ({
  inlineEmailHtml: (html: string) => html,
}))
mock.module("@/lib/email/email-rbac", () => ({
  canDispatchEmail: () => true,
}))

const findTeamBlocklistedEmailsMock = mock(async () => new Set<string>())
mock.module("@/lib/email/email-contact-blocklist", () => ({
  EMAIL_BLOCKLIST_NAME: "Bloqueados",
  ensureTeamEmailBlocklist: mock(async () => ({ id: "bl-1", isBlocklist: true })),
  findTeamBlocklistedEmails: findTeamBlocklistedEmailsMock,
  excludeBlocklistedEmails: <T extends { email: string }>(
    recipients: T[],
    blocklistedEmails: Set<string>
  ) => {
    if (blocklistedEmails.size === 0) return recipients
    return recipients.filter(
      (recipient) => !blocklistedEmails.has(recipient.email.trim().toLowerCase())
    )
  },
}))

const listRadarSegmentEmailRecipientsMock = mock(
  async () => [] as Array<{ email: string; name: string | null; customFields: Record<string, unknown> | null }>
)
const listRadarSegmentProfileEmailsMock = mock(async () => [] as string[])
const listRadarSegmentEmailRecipientPageMock = mock(
  async (
    _teamId: string,
    _slug: string,
    page?: { skip: number; take: number }
  ) => {
    const recipients = await listRadarSegmentEmailRecipientsMock()
    if (!page) return { recipients, exhausted: true }
    return {
      recipients: recipients.slice(page.skip, page.skip + page.take),
      exhausted: page.skip + page.take >= recipients.length,
    }
  }
)
mock.module("@/lib/radar/list-segment-recipients", () => ({
  listRadarSegmentEmailRecipients: listRadarSegmentEmailRecipientsMock,
  listRadarSegmentProfileEmails: listRadarSegmentProfileEmailsMock,
  listRadarSegmentEmailRecipientPage: listRadarSegmentEmailRecipientPageMock,
}))

mock.module("@/lib/email/notify-campaign-dispatch-failure", () => ({
  notifyCampaignDispatchFailure: mock(async () => {}),
}))

// --- Fila email-campaign-dispatch (Fase 4 / PR1) — evita bater no @vercel/queue
// real (que precisa de OIDC token e só funciona dentro de uma Vercel Function).
const publishEmailCampaignDispatchWakeMock = mock(async (..._args: unknown[]) => ({
  messageId: "msg-1",
}))
const publishEmailCampaignDispatchOverflowWakeMock = mock(async (..._args: unknown[]) => ({
  messageId: "msg-overflow",
}))
mock.module("@/lib/queues/email-campaign-dispatch", () => ({
  publishEmailCampaignDispatchWake: publishEmailCampaignDispatchWakeMock,
  publishEmailCampaignDispatchOverflowWake: publishEmailCampaignDispatchOverflowWakeMock,
}))

const findBouncedEmailsMock = mock(async (_emails: string[]) => new Set<string>())
const createSnapshotListMock = mock(async () => ({ id: "snap-list-1" }))
const createSnapshotContactsMock = mock(async () => 0)
const updateSnapshotContactCountMock = mock(async () => {})
mock.module("@/app/api/infra/data/repositories/emailContactList/EmailContactListRepository", () => ({
  emailContactListRepository: {
    findBouncedEmails: findBouncedEmailsMock,
    createList: createSnapshotListMock,
    createContacts: createSnapshotContactsMock,
    updateContactCount: updateSnapshotContactCountMock,
    findExistingEmailsInList: mock(async () => new Set<string>()),
  },
}))
mock.module(
  "@/app/api/infra/data/repositories/emailContactRadarSyncOutbox/EmailContactRadarSyncOutboxRepository",
  () => ({
    emailContactRadarSyncOutboxRepository: {
      upsertPendingForContacts: mock(async () => {}),
    },
  })
)


const pgQueryMock = mock(async (sql: string) => {
  if (String(sql).includes("pg_try_advisory_lock")) {
    return { rows: [{ acquired: true }] }
  }
  return { rows: [] }
})
const pgConnectMock = mock(async () => {})
const pgEndMock = mock(async () => {})
mock.module("pg", () => ({
  Client: class {
    connect = pgConnectMock
    end = pgEndMock
    query = pgQueryMock
  },
}))

// =============================================================================
// Importação dinâmica — APÓS todos os mocks
// =============================================================================
const { EmailCampaignUseCase, EMAIL_CAMPAIGN_FAILURE_MESSAGES } = await import(
  "./EmailCampaignUseCase"
)
const { RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE } = await import(
  "@/lib/email/campaign-dispatch-guards"
)
const { CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE } = await import(
  "@/lib/email/resolve-campaign-from"
)
const { aggregateDispatchLogCounters } = await import(
  "@/lib/email/campaign-dispatch-progress"
)

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  process.env.DIRECT_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres"
}


type ProgressLogFixture = {
  dispatchId?: string | null
  status: string
  sentAt?: Date | null
  resendEmailId?: string | null
}

/** Simula a agregação SQL de progresso a partir dos mesmos fixtures de log. */
function mockLogCounterAggregation(logs: ProgressLogFixture[]) {
  queryRawMock.mockImplementation(async (...args: unknown[]) => {
    const teamId = args[1]
    expect(teamId).toBe("team-1")
    const byDispatch = new Map<string, ProgressLogFixture[]>()
    for (const log of logs) {
      if (!log.dispatchId) continue
      const bucket = byDispatch.get(log.dispatchId) ?? []
      bucket.push(log)
      byDispatch.set(log.dispatchId, bucket)
    }
    return [...byDispatch.entries()].map(([dispatchId, dispatchLogs]) => ({
      dispatchId,
      ...aggregateDispatchLogCounters(dispatchLogs),
    }))
  })
}

// =============================================================================
// Helpers de fixture
// =============================================================================

function makeRecipients(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    email: `r${i}@test.com`,
    name: `R${i}`,
    contactId: `c${i}`,
    customFields: null as Record<string, unknown> | null,
  }))
}

function makeDefaultDispatchInput(
  recipients: ReturnType<typeof makeRecipients> = [],
  resolvedFrom?: { fromName: string; fromEmail: string }
) {
  return {
    recipients,
    globalDefaults: {} as Record<string, string | null | undefined>,
    templateVariables: [] as unknown[],
    subject: "Campanha Teste",
    html: "<p>Olá {{nome}}</p>",
    from: "Test <test@sender.com>",
    replyTo: null as string | null,
    resolvedFrom:
      resolvedFrom ?? { fromName: "Corretor Studio", fromEmail: "contato@corretorstudio.com" },
  }
}

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "camp-1",
    name: "Campanha Teste",
    status: "draft",
    templateId: "tpl-ref-1",
    contactListId: "list-1",
    radarSegmentSlug: null,
    parentCampaignId: null,
    audienceContactIds: [] as string[],
    contactList: { id: "list-1", name: "Lista Test", totalContacts: 10 },
    team: { master: { id: "master-1", timezone: "America/Sao_Paulo" } },
    ...overrides,
  }
}

function makeSendingDispatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "dispatch-1",
    campaignId: "camp-1",
    teamId: "team-1",
    dispatchNumber: 1,
    batchIdempotencyScheme: "contentHash",
    templateHtml: "<p>Olá {{nome}}</p>",
    templateSubject: "Assunto {{nome}}",
    totalRecipients: 3,
    contactListId: "list-1",
    radarSegmentSlug: null,
    templateId: "tpl-1",
    retryFailedOnly: false,
    reservedCredits: 3,
    hasCampaignsBetaAccess: false,
    materializeSourceOffset: 0,
    createdAt: new Date(),
    status: "sending",
    campaign: {
      name: "Campanha Teste",
      status: "sending",
      audienceContactIds: [] as string[],
      contactListId: "list-1",
      radarSegmentSlug: null,
    },
    ...overrides,
  }
}

function persistDispatchSourceOffset(initial: ReturnType<typeof makeSendingDispatch>) {
  let current = {
    ...initial,
    materializeSourceOffset: Number(initial.materializeSourceOffset ?? 0),
  }
  emailCampaignDispatchFindFirstMock.mockImplementation(async () => current)
  emailCampaignDispatchUpdateMock.mockImplementation(async (...args: unknown[]) => {
    const data = (args[0] as { data?: { materializeSourceOffset?: number } } | undefined)?.data
    if (typeof data?.materializeSourceOffset === "number") {
      current = { ...current, materializeSourceOffset: data.materializeSourceOffset }
    }
    return current
  })
  return () => current
}

function restoreRadarRecipientPageMock() {
  listRadarSegmentEmailRecipientPageMock.mockImplementation(
    async (
      _teamId: string,
      _slug: string,
      page?: { skip: number; take: number }
    ) => {
      const recipients = await listRadarSegmentEmailRecipientsMock()
      if (!page) return { recipients, exhausted: true }
      return {
        recipients: recipients.slice(page.skip, page.skip + page.take),
        exhausted: page.skip + page.take >= recipients.length,
      }
    }
  )
}

type MaterializedQueuedLog = {
  id: string
  recipientEmail: string
  recipientName: string | null
  status: string
  sentAt?: Date | null
}

let materializedQueuedLogs: MaterializedQueuedLog[] = []

function installQueuedLogStore() {
  materializedQueuedLogs = []
  createQueuedLogsMock.mockImplementation(
    async (inputs: Array<{ recipientEmail: string; recipientName?: string | null }>) =>
      inputs.map((input) => {
        const log: MaterializedQueuedLog = {
          id: `log-${input.recipientEmail}-${materializedQueuedLogs.length}`,
          recipientEmail: input.recipientEmail,
          recipientName: input.recipientName ?? null,
          status: "queued",
        }
        materializedQueuedLogs.push(log)
        return { email: input.recipientEmail, logId: log.id }
      })
  )
  markManyTeamEmailLogsSentMock.mockImplementation(async (entries: Array<{ logId: string }>) => {
    const ids = new Set(entries.map((entry) => entry.logId))
    for (const log of materializedQueuedLogs) {
      if (ids.has(log.id)) {
        log.status = "sent"
        log.sentAt = new Date()
      }
    }
  })
  markTeamEmailLogFailedMock.mockImplementation(async (logId: string) => {
    const log = materializedQueuedLogs.find((item) => item.id === logId)
    if (log) log.status = "failed"
  })
}

function queuedLogFindManyImpl(args: unknown) {
  const typed = args as {
    where?: {
      status?: unknown
      dispatchId?: string
      campaignId?: string
      recipientEmail?: { in?: string[] }
    }
    take?: number
  }
  const where = typed?.where
  if (where?.recipientEmail?.in) {
    const wanted = new Set(where.recipientEmail.in.map((email) => email.trim().toLowerCase()))
    return materializedQueuedLogs.filter((log) => wanted.has(log.recipientEmail.trim().toLowerCase()))
  }
  if (where?.status === "queued") {
    const queued = materializedQueuedLogs.filter((log) => log.status === "queued")
    return typeof typed.take === "number" ? queued.slice(0, typed.take) : queued
  }
  if (where?.dispatchId) {
    return materializedQueuedLogs
  }
  return []
}

function queuedLogCountImpl(args: unknown) {
  const where = (
    args as {
      where?: { status?: unknown; dispatchId?: string; sentAt?: unknown; campaignId?: string }
    }
  )?.where
  if (where?.status === "queued") {
    return materializedQueuedLogs.filter((log) => log.status === "queued").length
  }
  if (where?.sentAt) {
    return materializedQueuedLogs.filter((log) => log.sentAt).length
  }
  if (where?.dispatchId) {
    return materializedQueuedLogs.length
  }
  return 0
}

function autoChunkDispatched(result: {
  sent: number
  failed: number
  dispatched: Array<{ email: string; resendId: string }>
  providerErrors: Array<{ message: string; emails: string[]; statusCode?: number }>
}) {
  return async (params: unknown) => {
    const typed = params as {
      onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
    }
    if (result.dispatched.length > 0) {
      await typed.onChunkDispatched?.(result.dispatched)
    }
    return result
  }
}

function findManyCampaignLogsOrQueued(
  campaignLogs: Array<{ recipientEmail: string; status: string }>
) {
  return async (args: unknown) => {
    const where = (args as { where?: { status?: unknown; dispatchId?: string } })?.where
    if (where?.status === "queued" || where?.dispatchId) {
      return queuedLogFindManyImpl(args)
    }
    return campaignLogs
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

// Configura o mock de template (2 chamadas: ref → template completo)
function setupTemplateMock() {
  emailTemplateFindFirstMock.mockImplementation(async () => ({
    id: "tpl-1",
    name: "Template Test",
    subject: "Assunto {{nome}}",
    html: "<p>Olá {{nome}}</p>",
    variables: [],
    versionNumber: 1,
    versionGroupId: "vg-1",
  }))
}

// Todos os mocks que precisam ser resetados entre testes
const allMocks = [
  emailCampaignFindFirstMock,
  emailCampaignFindManyMock,
  emailCampaignCountMock,
  emailCampaignGroupByMock,
  emailCampaignUpdateManyMock,
  emailCampaignUpdateMock,
  emailTemplateFindFirstMock,
  emailCampaignDispatchAggregateMock,
  emailCampaignDispatchCreateMock,
  emailCampaignDispatchFindFirstMock,
  emailCampaignDispatchFindManyMock,
  emailCampaignDispatchUpdateMock,
  emailCampaignDispatchUpdateManyMock,
  emailTeamSenderFindFirstMock,
  emailLogFindManyMock,
  emailLogCountMock,
  emailLogGroupByMock,
  queryRawMock,
  queryRawUnsafeMock,
  pgQueryMock,
  pgConnectMock,
  pgEndMock,
  profileFindManyMock,
  transactionMock,
  reserveCreditsMock,
  releaseCreditsMock,
  formatInsufficientMock,
  createQueuedLogsMock,
  markManyTeamEmailLogsSentMock,
  markTeamEmailLogFailedMock,
  resolveEmailBetaAccessMock,
  resolveRadarBetaAccessMock,
  processPendingBatchMock,
  buildCampaignDispatchInputMock,
  findUnresolvedTokensMock,
  listActiveRecipientsMock,
  findTeamBlocklistedEmailsMock,
  listRadarSegmentEmailRecipientsMock,
  listRadarSegmentProfileEmailsMock,
  dispatchBatchMock,
  emailTeamSettingsFindUniqueMock,
  publishEmailCampaignDispatchWakeMock,
  publishEmailCampaignDispatchOverflowWakeMock,
  countSuppressedRecipientsForListsMock,
  countSuppressedRecipientsForEmailsMock,
  findBouncedEmailsMock,
  createSnapshotListMock,
  createSnapshotContactsMock,
  updateSnapshotContactCountMock,
]

// =============================================================================
// EmailCampaignUseCase.send
// =============================================================================

describe("EmailCampaignUseCase.send", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()

    // Restaurar implementações padrão após clear
    emailCampaignFindFirstMock.mockImplementation(async () => makeCampaign())
    emailCampaignUpdateManyMock.mockImplementation(async () => ({ count: 1 }))
    emailCampaignUpdateMock.mockImplementation(async () => ({ parentCampaignId: null }))
    emailCampaignDispatchAggregateMock.mockImplementation(async () => ({
      _max: { dispatchNumber: 0 },
    }))
    emailCampaignDispatchCreateMock.mockImplementation(async () => ({ id: "dispatch-1" }))
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => makeSendingDispatch())
    emailCampaignDispatchUpdateMock.mockImplementation(async () => ({}))
    emailTeamSenderFindFirstMock.mockImplementation(async () => null)
    installQueuedLogStore()
    emailLogFindManyMock.mockImplementation(async (args: unknown) => queuedLogFindManyImpl(args))
    emailLogCountMock.mockImplementation(async (args: unknown) => queuedLogCountImpl(args))
    queryRawMock.mockImplementation(async () => [])
    queryRawUnsafeMock.mockImplementation(async () => [{ acquired: true }])
    pgQueryMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes("pg_try_advisory_lock")) {
        return { rows: [{ acquired: true }] }
      }
      return { rows: [] }
    })
    transactionMock.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    reserveCreditsMock.mockImplementation(async () => ({ ok: true as const }))
    releaseCreditsMock.mockImplementation(async () => {})
    resolveEmailBetaAccessMock.mockImplementation(async () => false)
    resolveRadarBetaAccessMock.mockImplementation(async () => true)
    processPendingBatchMock.mockImplementation(async () => ({
      processed: 0,
      failed: 0,
      skipped: 0,
    }))
    buildCampaignDispatchInputMock.mockImplementation(async () => makeDefaultDispatchInput([]))
    findUnresolvedTokensMock.mockImplementation(() => [])
    listActiveRecipientsMock.mockImplementation(async () => [])
    findTeamBlocklistedEmailsMock.mockImplementation(async () => new Set<string>())
    listRadarSegmentEmailRecipientsMock.mockImplementation(async () => [])
    listRadarSegmentProfileEmailsMock.mockImplementation(async () => [])
    restoreRadarRecipientPageMock()
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 0,
      failed: 0,
      dispatched: [],
      providerErrors: [],
    }))
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => null)
    findBouncedEmailsMock.mockImplementation(async () => new Set<string>())
    createSnapshotListMock.mockImplementation(async () => ({ id: "snap-list-1" }))
    createSnapshotContactsMock.mockImplementation(async () => 0)
    updateSnapshotContactCountMock.mockImplementation(async () => {})
    setupTemplateMock()
  })

  // ---------------------------------------------------------------------------
  // C9 — campanha não encontrada
  // ---------------------------------------------------------------------------
  it("C9 — campanha não encontrada → isValid: false antes do lock", async () => {
    emailCampaignFindFirstMock.mockImplementation(async () => null as never)

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-inexistente", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("não encontrada")
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // C3 — zero destinatários
  // ---------------------------------------------------------------------------
  it("C3 — zero destinatários → NO_RECIPIENTS_LIST; lock e créditos NÃO chamados", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput([])
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("contato")
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  it("startManualDispatch não chama createQueuedTeamEmailLogs e devolve dispatchId + totalRecipients", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(3))
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(createQueuedLogsMock).not.toHaveBeenCalled()
    expect(dispatchBatchMock).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({
      dispatchId: "dispatch-1",
      totalRecipients: 3,
      status: "sending",
    })
  })

  it("processDispatchQueueBatch materializa logs queued em lote na primeira execução", async () => {
    const recipients = makeRecipients(2)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({ totalRecipients: 2, reservedCredits: 2 })
    )
    dispatchBatchMock.mockImplementation(
      autoChunkDispatched({
        sent: 2,
        failed: 0,
        dispatched: recipients.map((recipient) => ({
          email: recipient.email,
          resendId: `re_${recipient.email}`,
        })),
        providerErrors: [],
      })
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.processDispatchQueueBatch("dispatch-1")

    expect(createQueuedLogsMock).toHaveBeenCalledTimes(1)
    expect(createQueuedLogsMock.mock.calls[0]?.[0]).toHaveLength(2)
    expect(output.isValid).toBe(true)
    expect(dispatchBatchMock).toHaveBeenCalledTimes(1)
  })

  it("startManualDispatch exclui e-mail da blocklist da reserva de créditos", async () => {
    const recipients = makeRecipients(2)
    listActiveRecipientsMock.mockImplementation(async () => recipients)
    findTeamBlocklistedEmailsMock.mockImplementation(async () => new Set(["r1@test.com"]))
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ audienceContactIds: ["c0", "c1"] })
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ totalRecipients: 1 })
    expect((reserveCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(1)
  })

  it("processDispatchQueueBatch pagina a audiência no segundo lote sem relistar tudo", async () => {
    const recipients = makeRecipients(3)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    persistDispatchSourceOffset(
      makeSendingDispatch({ totalRecipients: 3, reservedCredits: 3 })
    )
    dispatchBatchMock.mockImplementation(
      autoChunkDispatched({
        sent: 2,
        failed: 0,
        dispatched: recipients.slice(0, 2).map((recipient) => ({
          email: recipient.email,
          resendId: `re_${recipient.email}`,
        })),
        providerErrors: [],
      })
    )

    const uc = new EmailCampaignUseCase()
    const first = await uc.processDispatchQueueBatch("dispatch-1", { batchSize: 2 })
    expect(first.isValid).toBe(true)
    expect(createQueuedLogsMock).toHaveBeenCalledTimes(1)
    expect(createQueuedLogsMock.mock.calls[0]?.[0]).toHaveLength(2)
    expect(listActiveRecipientsMock.mock.calls.some((call) => {
      const page = call[2] as { skip?: number; take?: number } | undefined
      return page?.skip === 0 && page?.take === 2
    })).toBe(true)

    listActiveRecipientsMock.mockClear()
    createQueuedLogsMock.mockClear()
    const second = await uc.processDispatchQueueBatch("dispatch-1", { batchSize: 2 })
    expect(second.isValid).toBe(true)
    const pageCalls = listActiveRecipientsMock.mock.calls.map((call) => call[2] as { skip?: number; take?: number } | undefined)
    expect(pageCalls.some((page) => page?.skip === 2 && page.take === 2)).toBe(true)
    expect(
      pageCalls.every((page) => !page || page.take === 2)
    ).toBe(true)
  })

  it("processDispatchQueueBatch continua paginando quando a blocklist encolhe o lote da lista", async () => {
    const recipients = makeRecipients(3)
    listActiveRecipientsMock.mockImplementation(async () => recipients)
    findTeamBlocklistedEmailsMock.mockImplementation(async () => new Set(["r0@test.com"]))
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({ totalRecipients: 2, reservedCredits: 2 })
    )
    dispatchBatchMock.mockImplementation(
      autoChunkDispatched({
        sent: 2,
        failed: 0,
        dispatched: [
          { email: "r1@test.com", resendId: "re_r1" },
          { email: "r2@test.com", resendId: "re_r2" },
        ],
        providerErrors: [],
      })
    )

    const uc = new EmailCampaignUseCase()
    const first = await uc.processDispatchQueueBatch("dispatch-1", { batchSize: 2 })
    expect(first.isValid).toBe(true)
    const queued = createQueuedLogsMock.mock.calls[0]?.[0] as Array<{ recipientEmail: string }>
    expect(queued.map((entry) => entry.recipientEmail)).toEqual(["r1@test.com", "r2@test.com"])
    const pageCalls = listActiveRecipientsMock.mock.calls.map(
      (call) => call[2] as { skip?: number; take?: number } | undefined
    )
    expect(pageCalls.some((page) => page?.skip === 2 && page.take === 2)).toBe(true)
  })

  it("processDispatchQueueBatch pagina Radar pelo cursor da fonte, não por emailLog.count", async () => {
    listRadarSegmentEmailRecipientPageMock.mockImplementation(
      async (_teamId: string, _slug: string, page?: { skip: number; take: number }) => {
        const skip = page?.skip ?? 0
        const take = page?.take ?? 500
        if (skip >= 1000) return { recipients: [], exhausted: true }
        return {
          recipients: [
            {
              email: `p${skip}@test.com`,
              name: `P${skip}`,
              customFields: null,
            },
          ],
          exhausted: skip + take >= 1000,
        }
      }
    )
    persistDispatchSourceOffset(
      makeSendingDispatch({
        totalRecipients: 4,
        reservedCredits: 4,
        contactListId: null,
        radarSegmentSlug: "email_marketable",
        campaign: {
          name: "Campanha Teste",
          status: "sending",
          audienceContactIds: [],
          contactListId: null,
          radarSegmentSlug: "email_marketable",
        },
      })
    )
    dispatchBatchMock.mockImplementation(
      autoChunkDispatched({
        sent: 2,
        failed: 0,
        dispatched: [
          { email: "p0@test.com", resendId: "re_p0" },
          { email: "p2@test.com", resendId: "re_p2" },
        ],
        providerErrors: [],
      })
    )

    const uc = new EmailCampaignUseCase()
    const first = await uc.processDispatchQueueBatch("dispatch-1", { batchSize: 2 })
    expect(first.isValid).toBe(true)
    const firstSkips = listRadarSegmentEmailRecipientPageMock.mock.calls.map(
      (call) => (call[2] as { skip?: number } | undefined)?.skip ?? 0
    )
    expect(firstSkips[0]).toBe(0)
    expect(createQueuedLogsMock.mock.calls[0]?.[0]).toHaveLength(2)

    listRadarSegmentEmailRecipientPageMock.mockClear()
    createQueuedLogsMock.mockClear()
    const second = await uc.processDispatchQueueBatch("dispatch-1", { batchSize: 2 })
    expect(second.isValid).toBe(true)
    const secondSkips = listRadarSegmentEmailRecipientPageMock.mock.calls.map(
      (call) => (call[2] as { skip?: number } | undefined)?.skip ?? 0
    )
    expect(secondSkips[0]).toBe(4)
    expect(secondSkips.includes(0)).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // C8 — tokens não resolvidos
  // ---------------------------------------------------------------------------
  it("C8 — tokens não resolvidos → bloqueia disparo; erros contêm os tokens", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(5))
    )
    findUnresolvedTokensMock.mockImplementation(() => ["preco", "plano"])

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("{{preco}}")
    expect(output.errorMessages[0]).toContain("{{plano}}")
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // C10 — lock concorrente (updateMany count=0)
  // ---------------------------------------------------------------------------
  it("C10 — lock concorrente: updateMany count=0 → isValid: false; créditos NÃO reservados", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(10))
    )
    emailCampaignUpdateManyMock.mockImplementation(async () => ({ count: 0 }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("já está sendo enviada")
    expect(reserveCreditsMock).not.toHaveBeenCalled()
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // C4 — crédito: sem assinatura
  // ---------------------------------------------------------------------------
  it("C4 — reserveCredits no_subscription → isValid: false; restaura status da campanha", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(10))
    )
    reserveCreditsMock.mockImplementation(async () => ({
      ok: false as const,
      reason: "no_subscription" as const,
      available: 0,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_CREDITS)
    expect(emailCampaignUpdateMock).toHaveBeenCalledTimes(1)
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // C5 — crédito: saldo insuficiente
  // ---------------------------------------------------------------------------
  it("C5 — reserveCredits insufficient_balance → mensagem de formatInsufficientCreditsMessage", async () => {
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(10))
    )
    reserveCreditsMock.mockImplementation(async () => ({
      ok: false as const,
      reason: "insufficient_balance" as const,
      available: 3,
    }))
    formatInsufficientMock.mockImplementation(() => "Você precisa de 10, tem 3")

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe("Você precisa de 10, tem 3")
  })

  // ---------------------------------------------------------------------------
  // C7 — beta access bypassa créditos
  // ---------------------------------------------------------------------------
  it("C7 — beta access: reserveCredits e releaseCredits NÃO chamados", async () => {
    resolveEmailBetaAccessMock.mockImplementation(async () => true)
    const recipients = makeRecipients(5)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    dispatchBatchMock.mockImplementation(
      autoChunkDispatched({
        sent: 5,
        failed: 0,
        dispatched: recipients.map((r) => ({ email: r.email, resendId: `re_${r.email}` })),
        providerErrors: [],
      })
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(reserveCreditsMock).not.toHaveBeenCalled()
    expect(releaseCreditsMock).not.toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // T05/T06/T07 — gate Grupo Beta de Radar (SPEC D12)
  // ---------------------------------------------------------------------------
  it("T05 — com créditos mas fora do Beta Radar → bloqueia envio", async () => {
    resolveRadarBetaAccessMock.mockImplementation(async () => false)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(3))
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RADAR_BETA)
    expect(reserveCreditsMock).not.toHaveBeenCalled()
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  it("T06 — no Beta Radar com créditos → pode enviar", async () => {
    resolveRadarBetaAccessMock.mockImplementation(async () => true)
    resolveEmailBetaAccessMock.mockImplementation(async () => false)
    const recipients = makeRecipients(2)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    dispatchBatchMock.mockImplementation(
      autoChunkDispatched({
        sent: 2,
        failed: 0,
        dispatched: recipients.map((r) => ({ email: r.email, resendId: `re_${r.email}` })),
        providerErrors: [],
      })
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(reserveCreditsMock).toHaveBeenCalled()
  })

  it("T06b — no Beta Radar com isenção de créditos de e-mail → pode enviar sem debitar", async () => {
    resolveRadarBetaAccessMock.mockImplementation(async () => true)
    resolveEmailBetaAccessMock.mockImplementation(async () => true)
    const recipients = makeRecipients(2)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    dispatchBatchMock.mockImplementation(
      autoChunkDispatched({
        sent: 2,
        failed: 0,
        dispatched: recipients.map((r) => ({ email: r.email, resendId: `re_${r.email}` })),
        providerErrors: [],
      })
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(reserveCreditsMock).not.toHaveBeenCalled()
  })

  it("T07 — Beta Radar de outro time (activeTeamId fora do escopo) → bloqueia", async () => {
    // resolveRadarBetaAccess já encapsula ALL_TEAMS vs SPECIFIC_TEAMS pelo teamId ativo.
    resolveRadarBetaAccessMock.mockImplementation(async () => false)

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", { ...teamCtx, teamId: "team-outro" })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RADAR_BETA)
    expect(resolveRadarBetaAccessMock).toHaveBeenCalled()
    const call = resolveRadarBetaAccessMock.mock.calls[0] as unknown as [
      { teamId: string }
    ]
    expect(call[0].teamId).toBe("team-outro")
  })

  // ---------------------------------------------------------------------------
  // C6 — todos os e-mails falham (sent=0)
  // ---------------------------------------------------------------------------
  it("C6 — sent=0: isValid: false; créditos todos liberados no finally", async () => {
    const recipients = makeRecipients(10)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 0,
      failed: 10,
      dispatched: [],
      providerErrors: [
        {
          message: "Invalid `to` field",
          statusCode: 422,
          emails: recipients.map((r) => r.email),
        },
      ],
    }))
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({ totalRecipients: 10, reservedCredits: 10 })
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.result.sent).toBe(0)
    expect(markTeamEmailLogFailedMock).toHaveBeenCalled()
    const failedReasons = markTeamEmailLogFailedMock.mock.calls.map(
      (call) => (call as unknown as [string, string])[1]
    )
    expect(failedReasons.every((reason) => reason.includes("422") || reason.includes("Invalid `to`"))).toBe(
      true
    )
    // unused = max(0, 10 - 0) = 10 → releaseCredits("team-1", 10)
    expect(releaseCreditsMock).toHaveBeenCalledTimes(1)
    expect((releaseCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(10)
  })

  // ---------------------------------------------------------------------------
  // C12 — e-mails pipe (casos reais) filtrados antes do Resend
  // ---------------------------------------------------------------------------
  it("C12 — destinatários com pipe: não chama dispatchBatch; marca failed com motivo local; campanha failed", async () => {
    const recipients = [
      {
        email: "carol.ocipriani@gmail.com|hugopoli@gmail.com",
        name: "Carol/Hugo",
        contactId: "c-pipe-1",
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "financeiro@newcorban.com.br|financeiro@grupodigital.com.br",
        name: "Financeiro",
        contactId: "c-pipe-2",
        customFields: null as Record<string, unknown> | null,
      },
    ]
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(dispatchBatchMock).not.toHaveBeenCalled()
    expect(markTeamEmailLogFailedMock).toHaveBeenCalledTimes(2)
    expect(output.result.sent).toBe(0)

    const failedReasons = markTeamEmailLogFailedMock.mock.calls.map(
      (call) => (call as unknown as [string, string])[1]
    )
    expect(
      failedReasons.every((reason) => reason.includes("E-mail inválido para o Resend"))
    ).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // C13 — mix: válidos enviados + pipe filtrado localmente
  // ---------------------------------------------------------------------------
  it("C13 — mix válido + pipe: dispatchBatch só recebe válidos; pipe falha localmente", async () => {
    const recipients = [
      {
        email: "ok@example.com",
        name: "Ok",
        contactId: "c-ok",
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "carol.ocipriani@gmail.com|hugopoli@gmail.com",
        name: "Pipe",
        contactId: "c-pipe",
        customFields: null as Record<string, unknown> | null,
      },
    ]
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({ totalRecipients: 2, reservedCredits: 2 })
    )
    dispatchBatchMock.mockImplementation(async (params: unknown) => {
      const typed = params as {
        recipients: Array<{ email: string }>
        onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
      }
      expect(typed.recipients).toHaveLength(1)
      expect(typed.recipients[0]?.email).toBe("ok@example.com")
      const dispatched = [{ email: "ok@example.com", resendId: "re_ok" }]
      await typed.onChunkDispatched?.(dispatched)
      return {
        sent: 1,
        failed: 0,
        dispatched,
        providerErrors: [],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.result.sent).toBe(1)
    expect(output.result.failed).toBe(1)
    expect(dispatchBatchMock).toHaveBeenCalledTimes(1)
    expect(markTeamEmailLogFailedMock).toHaveBeenCalledTimes(1)
    expect((markTeamEmailLogFailedMock.mock.calls[0] as unknown as [string, string])[1]).toContain(
      "carol.ocipriani@gmail.com|hugopoli@gmail.com"
    )
  })

  // ---------------------------------------------------------------------------
  // C1 — CENÁRIO PRINCIPAL: 2000 e-mails, 20 chunks, onChunkDispatched 20×
  // ---------------------------------------------------------------------------
  it("C1 — 2000 e-mails: onChunkDispatched invocado 20×; markManyTeamEmailLogsSent 20× c/ 100 entradas cada", async () => {
    const recipients2000 = makeRecipients(2000)

    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients2000)
    )
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({ totalRecipients: 2000, reservedCredits: 2000 })
    )

    // dispatchBatch chama onChunkDispatched para cada chunk de 100 do lote atual
    dispatchBatchMock.mockImplementation(async (_p: unknown) => {
      const params = _p as {
        recipients: Array<{ email: string }>
        onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
      }
      const dispatched: Array<{ email: string; resendId: string }> = []
      for (let i = 0; i < params.recipients.length; i += 100) {
        const chunk = params.recipients.slice(i, i + 100).map((recipient) => ({
          email: recipient.email,
          resendId: `re_${recipient.email}`,
        }))
        await params.onChunkDispatched?.(chunk)
        dispatched.push(...chunk)
      }
      return {
        sent: dispatched.length,
        failed: 0,
        dispatched,
        providerErrors: [],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.result.sent).toBe(2000)
    expect(output.result.failed).toBe(0)

    // reservou exatamente 2000 créditos
    expect(reserveCreditsMock).toHaveBeenCalledTimes(1)
    expect((reserveCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(2000)

    // markManyTeamEmailLogsSent chamado 20× (uma vez por chunk via onChunkDispatched)
    expect(markManyTeamEmailLogsSentMock).toHaveBeenCalledTimes(20)

    // cada chamada recebeu exatamente 100 entradas
    for (const callArgs of markManyTeamEmailLogsSentMock.mock.calls) {
      const entries = (callArgs as unknown as [Array<{ logId: string; resendEmailId: string }>])[0]
      expect(entries).toHaveLength(100)
    }

    // markTeamEmailLogFailed NÃO chamado (nenhuma falha)
    expect(markTeamEmailLogFailedMock).not.toHaveBeenCalled()

    // unused = max(0, 2000-2000) = 0 → releaseCredits NÃO chamado
    expect(releaseCreditsMock).not.toHaveBeenCalled()

    // dispatchBatch chamado 4× (lotes de 500 no consumer)
    expect(dispatchBatchMock).toHaveBeenCalledTimes(4)
  })

  // ---------------------------------------------------------------------------
  // C2 — 2000 e-mails: chunk 4 falha → 1900 sent, 100 failed
  // ---------------------------------------------------------------------------
  it("C2 — 2000 e-mails / chunk 4 falha: markManyTeamEmailLogsSent 19×; markTeamEmailLogFailed 100×; releaseCredits 100", async () => {
    const recipients2000 = makeRecipients(2000)

    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients2000)
    )
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({ totalRecipients: 2000, reservedCredits: 2000 })
    )

    // Chunk de e-mails r400–r499 falha — onChunkDispatched não é invocado para eles
    dispatchBatchMock.mockImplementation(async (_p: unknown) => {
      const params = _p as {
        recipients: Array<{ email: string }>
        onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
      }
      const dispatchedEntries: Array<{ email: string; resendId: string }> = []
      const failedEmails: string[] = []
      for (let i = 0; i < params.recipients.length; i += 100) {
        const slice = params.recipients.slice(i, i + 100)
        const isFailedChunk = slice.some((recipient) => recipient.email === "r400@test.com")
        if (isFailedChunk) {
          failedEmails.push(...slice.map((recipient) => recipient.email))
          continue
        }
        const chunk = slice.map((recipient) => ({
          email: recipient.email,
          resendId: `re_${recipient.email}`,
        }))
        await params.onChunkDispatched?.(chunk)
        dispatchedEntries.push(...chunk)
      }
      return {
        sent: dispatchedEntries.length,
        failed: failedEmails.length,
        dispatched: dispatchedEntries,
        providerErrors:
          failedEmails.length > 0
            ? [
                {
                  message: "Too many requests",
                  statusCode: 429,
                  emails: failedEmails,
                },
              ]
            : [],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.result.sent).toBe(1900)
    expect(output.result.failed).toBe(100)

    // onChunkDispatched foi chamado 19× → markManyTeamEmailLogsSent 19×
    expect(markManyTeamEmailLogsSentMock).toHaveBeenCalledTimes(19)

    // 100 destinatários do chunk 4 marcados como failed
    expect(markTeamEmailLogFailedMock).toHaveBeenCalledTimes(100)

    // unused = max(0, 2000-1900) = 100 → releaseCredits("team-1", 100)
    expect(releaseCreditsMock).toHaveBeenCalledTimes(1)
    expect((releaseCreditsMock.mock.calls[0] as unknown as [string, number])[0]).toBe("team-1")
    expect((releaseCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(100)
  })

  // ---------------------------------------------------------------------------
  // C14 — retryFailedOnly: só destinatários com falha (sem sucesso no provedor)
  // ---------------------------------------------------------------------------
  it("C14 — retryFailedOnly filtra só falhos; reserva créditos só pelos falhos", async () => {
    const allRecipients = makeRecipients(5)
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ status: "failed" })
    )
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(allRecipients)
    )
    emailLogFindManyMock.mockImplementation(
      findManyCampaignLogsOrQueued([
        { recipientEmail: "r0@test.com", status: "sent" },
        { recipientEmail: "r1@test.com", status: "delivered" },
        { recipientEmail: "r2@test.com", status: "failed" },
        { recipientEmail: "r3@test.com", status: "failed" },
        { recipientEmail: "r3@test.com", status: "opened" },
        { recipientEmail: "r4@test.com", status: "failed" },
      ])
    )
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({ retryFailedOnly: true, totalRecipients: 2 })
    )
    dispatchBatchMock.mockImplementation(async (params: unknown) => {
      const typed = params as {
        recipients: Array<{ email: string }>
        onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
      }
      const dispatched = typed.recipients.map((recipient) => ({
        email: recipient.email,
        resendId: `re_${recipient.email}`,
      }))
      await typed.onChunkDispatched?.(dispatched)
      return {
        sent: typed.recipients.length,
        failed: 0,
        dispatched,
        providerErrors: [],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx, { retryFailedOnly: true })

    expect(output.isValid).toBe(true)
    expect(dispatchBatchMock).toHaveBeenCalledTimes(1)
    const dispatchArgs = dispatchBatchMock.mock.calls[0] as unknown as [
      { recipients: Array<{ email: string }> },
    ]
    expect(dispatchArgs[0].recipients.map((recipient) => recipient.email).sort()).toEqual([
      "r2@test.com",
      "r4@test.com",
    ])
    expect(reserveCreditsMock).toHaveBeenCalledTimes(1)
    expect((reserveCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(2)
    expect(createQueuedLogsMock.mock.calls[0]?.[0]).toHaveLength(2)
  })

  it("C14b — failed sem elegíveis → NO_FAILED_RECIPIENTS; sem lock/créditos", async () => {
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ status: "failed" })
    )
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(3))
    )
    emailLogFindManyMock.mockImplementation(async () => [
      { recipientEmail: "r0@test.com", status: "sent" },
      { recipientEmail: "r1@test.com", status: "failed" },
      { recipientEmail: "r1@test.com", status: "delivered" },
      { recipientEmail: "r2@test.com", status: "bounced" },
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx, { retryFailedOnly: true })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_FAILED_RECIPIENTS)
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  it("C14c — failed sem log algum → reenvia toda a audiência (não '0 destinatários')", async () => {
    // Regressão 5.1: a tentativa anterior morreu antes de criar EmailLog (ex.: validação de
    // variáveis). Sem log 'failed', o critério por logs devolvia [] → NO_FAILED_RECIPIENTS.
    const allRecipients = makeRecipients(4)
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ status: "failed" })
    )
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(allRecipients)
    )
    emailLogFindManyMock.mockImplementation(findManyCampaignLogsOrQueued([]))
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({ retryFailedOnly: true, totalRecipients: 4 })
    )
    dispatchBatchMock.mockImplementation(async (params: unknown) => {
      const typed = params as {
        recipients: Array<{ email: string }>
        onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
      }
      const dispatched = typed.recipients.map((recipient) => ({
        email: recipient.email,
        resendId: `re_${recipient.email}`,
      }))
      await typed.onChunkDispatched?.(dispatched)
      return {
        sent: typed.recipients.length,
        failed: 0,
        dispatched,
        providerErrors: [],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx, { retryFailedOnly: true })

    expect(output.isValid).toBe(true)
    expect(dispatchBatchMock).toHaveBeenCalledTimes(1)
    const dispatchArgs = dispatchBatchMock.mock.calls[0] as unknown as [
      { recipients: Array<{ email: string }> },
    ]
    expect(dispatchArgs[0].recipients).toHaveLength(4)
    expect((reserveCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(4)
  })

  it("C14d — retryFailedOnly inclui destinatários queued travados (regressão Golden Cross)", async () => {
    // Dispatch travou por timeout (recoverStuckSendingCampaigns marca status failed),
    // mas os EmailLog nunca saíram de "queued" — antes do fix, ficavam permanentemente
    // órfãos: o critério de retry só olhava status "failed".
    const allRecipients = makeRecipients(3)
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ status: "failed" })
    )
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(allRecipients)
    )
    emailLogFindManyMock.mockImplementation(
      findManyCampaignLogsOrQueued([
        { recipientEmail: "r0@test.com", status: "queued" },
        { recipientEmail: "r1@test.com", status: "queued" },
        { recipientEmail: "r2@test.com", status: "sent" },
      ])
    )
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({ retryFailedOnly: true, totalRecipients: 2 })
    )
    dispatchBatchMock.mockImplementation(async (params: unknown) => {
      const typed = params as {
        recipients: Array<{ email: string }>
        onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
      }
      const dispatched = typed.recipients.map((recipient) => ({
        email: recipient.email,
        resendId: `re_${recipient.email}`,
      }))
      await typed.onChunkDispatched?.(dispatched)
      return {
        sent: typed.recipients.length,
        failed: 0,
        dispatched,
        providerErrors: [],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx, { retryFailedOnly: true })

    expect(output.isValid).toBe(true)
    expect(dispatchBatchMock).toHaveBeenCalledTimes(1)
    const dispatchArgs = dispatchBatchMock.mock.calls[0] as unknown as [
      { recipients: Array<{ email: string }> },
    ]
    expect(dispatchArgs[0].recipients.map((recipient) => recipient.email).sort()).toEqual([
      "r0@test.com",
      "r1@test.com",
    ])
  })

  it("C14e — retryFailedOnly não reinsere typo nem bounceado", async () => {
    const allRecipients = [
      ...makeRecipients(3),
      { email: "ana@gamil.com", name: "Ana", contactId: "c-gamil", customFields: null },
    ]
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ status: "failed" })
    )
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(allRecipients)
    )
    emailLogFindManyMock.mockImplementation(
      findManyCampaignLogsOrQueued([
        { recipientEmail: "r0@test.com", status: "failed" },
        { recipientEmail: "r1@test.com", status: "failed" },
        { recipientEmail: "r2@test.com", status: "bounced" },
        { recipientEmail: "ana@gamil.com", status: "failed" },
      ])
    )
    findBouncedEmailsMock.mockImplementation(async () => new Set(["r1@test.com"]))
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({ retryFailedOnly: true, totalRecipients: 1 })
    )
    dispatchBatchMock.mockImplementation(async (params: unknown) => {
      const typed = params as {
        recipients: Array<{ email: string }>
        onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
      }
      const dispatched = typed.recipients.map((recipient) => ({
        email: recipient.email,
        resendId: `re_${recipient.email}`,
      }))
      await typed.onChunkDispatched?.(dispatched)
      return {
        sent: typed.recipients.length,
        failed: 0,
        dispatched,
        providerErrors: [],
      }
    })

    const uc = new EmailCampaignUseCase()
    const output = await uc.send("camp-1", teamCtx, { retryFailedOnly: true })

    expect(output.isValid).toBe(true)
    const dispatchArgs = dispatchBatchMock.mock.calls[0] as unknown as [
      { recipients: Array<{ email: string }> },
    ]
    expect(dispatchArgs[0].recipients.map((recipient) => recipient.email)).toEqual(["r0@test.com"])
    expect((reserveCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(1)
  })

  it("materializeMissingContactIds não cria contato sendable para typo ou bounceado", async () => {
    findBouncedEmailsMock.mockImplementation(async () => new Set(["bounced@ok.com"]))

    const uc = new EmailCampaignUseCase()
    const result = await (
      uc as unknown as {
        materializeMissingContactIds: (params: {
          teamId: string
          profileId: string
          campaignName: string
          contacts: Array<{ contactId: string | null; email: string; name?: string | null }>
        }) => Promise<{ contactIds: string[]; snapshotListId: string | null }>
      }
    ).materializeMissingContactIds({
      teamId: "team-1",
      profileId: "profile-1",
      campaignName: "Segmento",
      contacts: [
        { contactId: "c-existing", email: "ok@test.com", name: "Ok" },
        { contactId: null, email: "ana@gamil.com", name: "Ana" },
        { contactId: null, email: "bounced@ok.com", name: "Bounce" },
      ],
    })

    expect(createSnapshotListMock).not.toHaveBeenCalled()
    expect(createSnapshotContactsMock).not.toHaveBeenCalled()
    expect(result.contactIds).toEqual(["c-existing"])
    expect(result.snapshotListId).toBeNull()
  })

  // ---------------------------------------------------------------------------
  // Tracking gate — domínio próprio sem métricas/CNAME bloqueia disparo
  // ---------------------------------------------------------------------------
  it("domínio partially_failed → bloqueia disparo até tracking estar pronto", async () => {
    const recipients = makeRecipients(3)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => ({
      resendDomainName: "backstageclub.com.br",
      resendDomainStatus: "partially_failed",
      resendOpenTracking: true,
      resendClickTracking: true,
      fromName: "Test",
      fromEmail: "test@backstageclub.com.br",
      replyTo: null,
      dispatchBlockedDates: [],
      dispatchTimeFrom: null,
      dispatchTimeTo: null,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE)
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
  })

  it("domínio partially_verified → bloqueia disparo até tracking estar pronto", async () => {
    const recipients = makeRecipients(3)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => ({
      resendDomainName: "example.com",
      resendDomainStatus: "partially_verified",
      resendOpenTracking: true,
      resendClickTracking: true,
      fromName: "Test",
      fromEmail: "test@example.com",
      replyTo: null,
      dispatchBlockedDates: [],
      dispatchTimeFrom: null,
      dispatchTimeTo: null,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE)
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
  })

  it("domínio verified com métricas desligadas → bloqueia disparo", async () => {
    const recipients = makeRecipients(3)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => ({
      resendDomainName: "example.com",
      resendDomainStatus: "verified",
      resendOpenTracking: false,
      resendClickTracking: false,
      fromName: "Test",
      fromEmail: "test@example.com",
      replyTo: null,
      dispatchBlockedDates: [],
      dispatchTimeFrom: null,
      dispatchTimeTo: null,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE)
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
  })

  it("domínio verified com métricas ligadas → permite disparo", async () => {
    const recipients = makeRecipients(3)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => ({
      resendDomainName: "example.com",
      resendDomainStatus: "verified",
      resendOpenTracking: true,
      resendClickTracking: true,
      fromName: "Test",
      fromEmail: "test@example.com",
      replyTo: null,
      dispatchBlockedDates: [],
      dispatchTimeFrom: null,
      dispatchTimeTo: null,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.successMessages.some((m) => m.includes("segundo plano"))).toBe(true)
    expect(output.result?.warnings ?? []).toEqual([])
    expect(emailCampaignUpdateManyMock).toHaveBeenCalled()
    expect(reserveCreditsMock).toHaveBeenCalled()
  })

  // ---------------------------------------------------------------------------
  // D12 — domínio failed continua bloqueado
  // ---------------------------------------------------------------------------
  it("D12 — domínio failed → bloqueia disparo antes do lock", async () => {
    const recipients = makeRecipients(3)
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients, {
        fromName: "Test",
        fromEmail: "test@example.com",
      })
    )
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => ({
      resendDomainName: "example.com",
      resendDomainStatus: "failed",
      fromName: "Test",
      fromEmail: "test@example.com",
      replyTo: null,
      dispatchBlockedDates: [],
      dispatchTimeFrom: null,
      dispatchTimeTo: null,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("Domínio de e-mail não verificado")
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
  })
})

// =============================================================================
// D13 — guard de domínio (assertCampaignFromIsSendable) nos 3 pontos de disparo
// =============================================================================

describe("D13 — guard de domínio bloqueando disparo", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()

    emailCampaignFindFirstMock.mockImplementation(async () => makeCampaign())
    emailCampaignFindManyMock.mockImplementation(async () => [])
    emailCampaignUpdateManyMock.mockImplementation(async () => ({ count: 1 }))
    emailCampaignUpdateMock.mockImplementation(async () => ({
      parentCampaignId: null,
      name: "Campanha Teste",
      teamId: "team-1",
      createdBy: null,
    }))
    emailCampaignDispatchUpdateManyMock.mockImplementation(async () => ({ count: 0 }))
    emailCampaignDispatchAggregateMock.mockImplementation(async () => ({
      _max: { dispatchNumber: 0 },
    }))
    emailCampaignDispatchCreateMock.mockImplementation(async () => ({ id: "dispatch-1" }))
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => ({ id: "dispatch-1" }))
    emailCampaignDispatchUpdateMock.mockImplementation(async () => ({}))
    emailTeamSenderFindFirstMock.mockImplementation(async () => null)
    emailLogFindManyMock.mockImplementation(async () => [])
    queryRawMock.mockImplementation(async () => [])
    queryRawUnsafeMock.mockImplementation(async () => [{ acquired: true }])
    pgQueryMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes("pg_try_advisory_lock")) {
        return { rows: [{ acquired: true }] }
      }
      return { rows: [] }
    })
    transactionMock.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    reserveCreditsMock.mockImplementation(async () => ({ ok: true as const }))
    releaseCreditsMock.mockImplementation(async () => {})
    resolveEmailBetaAccessMock.mockImplementation(async () => false)
    resolveRadarBetaAccessMock.mockImplementation(async () => true)
    processPendingBatchMock.mockImplementation(async () => ({
      processed: 0,
      failed: 0,
      skipped: 0,
    }))
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(3))
    )
    findUnresolvedTokensMock.mockImplementation(() => [])
    createQueuedLogsMock.mockImplementation(
      async (inputs: Array<{ recipientEmail: string }>) =>
        inputs.map((i) => ({ email: i.recipientEmail, logId: `log-${i.recipientEmail}` }))
    )
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 0,
      failed: 0,
      dispatched: [] as Array<{ email: string; resendId: string }>,
      providerErrors: [] as Array<{ message: string; emails: string[] }>,
    }))
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => null)
    setupTemplateMock()
  })

  function outsideSenderInput() {
    return makeDefaultDispatchInput(makeRecipients(3), {
      fromName: "Vendas",
      fromEmail: "vendas@empresaxyz.com.br",
    })
  }

  // --- Site A: startManualDispatch ---
  it("D13a — domínio null + sender próprio → bloqueia (Domínio não verificado) sem lock/créditos", async () => {
    emailTeamSenderFindFirstMock.mockImplementation(async () => ({
      name: "Vendas",
      email: "vendas@empresaxyz.com.br",
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE)
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
    expect(createQueuedLogsMock).not.toHaveBeenCalled()
  })

  it("D13b — domínio null sem sender → from de plataforma (contato) permite disparo", async () => {
    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(output.successMessages.some((m) => m.includes("segundo plano"))).toBe(true)
    expect(output.errorMessages).toHaveLength(0)
  })

  it("D13c — domínio verified + sender de outro domínio → bloqueia (remetente fora do domínio)", async () => {
    emailTeamSenderFindFirstMock.mockImplementation(async () => ({
      name: "Vendas",
      email: "vendas@empresaxyz.com.br",
    }))
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => ({
      resendDomainName: "example.com",
      resendDomainStatus: "verified",
      fromName: "Test",
      fromEmail: "team@example.com",
      replyTo: null,
      dispatchBlockedDates: [],
      dispatchTimeFrom: null,
      dispatchTimeTo: null,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("remetente da campanha não pertence")
    expect(emailCampaignUpdateManyMock).not.toHaveBeenCalled()
    expect(reserveCreditsMock).not.toHaveBeenCalled()
  })

  // --- Site C: dispatchScheduledCampaigns ---
  function makeScheduledCampaign() {
    return {
      id: "camp-sched",
      name: "Scheduled",
      teamId: "team-1",
      status: "scheduled",
      scheduledAt: new Date("2020-01-01T00:00:00.000Z"),
      contactListId: "list-1",
      radarSegmentSlug: null,
      parentCampaignId: null,
      audienceContactIds: [],
      createdBy: null,
      templateId: "tpl-1",
      template: {
        id: "tpl-1",
        name: "T",
        subject: "S",
        html: "<p>Hi</p>",
        variables: [],
        versionNumber: 1,
      },
      contactList: { id: "list-1", name: "Lista" },
      team: { master: { id: "master-1", timezone: "America/Sao_Paulo" } },
    }
  }

  function setupScheduledCampaignLock() {
    emailCampaignFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") return []
      if (whereArgs?.where?.status === "scheduled") return [makeScheduledCampaign()]
      return []
    })
    emailCampaignUpdateManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "scheduled") return { count: 1 }
      return { count: 0 }
    })
  }

  it("D13d — scheduled domínio null + sender próprio → marca campanha failed com msg de domínio", async () => {
    setupScheduledCampaignLock()
    emailTeamSenderFindFirstMock.mockImplementation(async () => ({
      name: "Vendas",
      email: "vendas@empresaxyz.com.br",
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.dispatchScheduledCampaigns({ maxCampaigns: 5 })

    expect(output.isValid).toBe(true)
    expect(output.result.dispatched).toBe(0)
    expect(emailCampaignUpdateMock).toHaveBeenCalled()
    const updateData = (emailCampaignUpdateMock.mock.calls[0] as unknown as [
      { data: { status?: string; errorMessage?: string } },
    ])[0].data
    expect(updateData.status).toBe("failed")
    expect(updateData.errorMessage).toBe(CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE)
    expect(emailCampaignDispatchCreateMock).not.toHaveBeenCalled()
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  it("D13e — scheduled domínio verified + sender de outro domínio → marca failed com msg de remetente", async () => {
    setupScheduledCampaignLock()
    emailTeamSenderFindFirstMock.mockImplementation(async () => ({
      name: "Vendas",
      email: "vendas@empresaxyz.com.br",
    }))
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => ({
      resendDomainName: "example.com",
      resendDomainStatus: "verified",
      fromName: "Test",
      fromEmail: "team@example.com",
      replyTo: null,
      dispatchBlockedDates: [],
      dispatchTimeFrom: null,
      dispatchTimeTo: null,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.dispatchScheduledCampaigns({ maxCampaigns: 5 })

    expect(output.isValid).toBe(true)
    expect(output.result.dispatched).toBe(0)
    expect(emailCampaignUpdateMock).toHaveBeenCalled()
    const updateData = (emailCampaignUpdateMock.mock.calls[0] as unknown as [
      { data: { status?: string; errorMessage?: string } },
    ])[0].data
    expect(updateData.status).toBe("failed")
    expect(updateData.errorMessage).toContain("remetente da campanha não pertence")
    expect(emailCampaignDispatchCreateMock).not.toHaveBeenCalled()
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  // --- Site B: resumeOrphanSendingDispatches ---
  it("D13f — órfão domínio null + sender arbitrário → nunca envia, marca failed, não conta resumed, resolve o EmailLog queued e libera créditos (bugfix: credit leak + reclaim loop)", async () => {
    emailCampaignDispatchFindManyMock.mockImplementation(async () => [
      {
        id: "dispatch-orphan",
        campaignId: "camp-1",
        teamId: "team-1",
        dispatchNumber: 1,
        batchIdempotencyScheme: "contentHash",
        templateHtml: "<p>Hi</p>",
        templateSubject: "S",
        totalRecipients: 1,
        triggeredBy: "profile-1",
        contactListId: "list-1",
        radarSegmentSlug: null,
        templateId: "tpl-1",
        reservedCredits: 1,
        hasCampaignsBetaAccess: false,
      },
    ])
    // 1ª chamada (resumeOrphanSendingDispatches lendo o lote órfão) e 2ª chamada
    // (1ª iteração do while de failDispatchOnDomainGuard) ainda veem o log
    // "queued"; da 3ª em diante ele já foi resolvido (markTeamEmailLogFailed)
    // e o while precisa parar — sem isso o loop nunca termina.
    let queuedLogFetches = 0
    emailLogFindManyMock.mockImplementation(async () => {
      queuedLogFetches += 1
      if (queuedLogFetches <= 2) {
        return [
          {
            id: "log-q",
            recipientEmail: "r0@test.com",
            recipientName: "R0",
            status: "queued",
          },
        ]
      }
      return []
    })
    emailTeamSenderFindFirstMock.mockImplementation(async () => ({
      name: "Vendas",
      email: "vendas@empresaxyz.com.br",
    }))

    const uc = new EmailCampaignUseCase()
    const resumed = await uc.resumeOrphanSendingDispatches({
      now: new Date("2020-01-01T00:05:00.000Z"),
    })

    expect(resumed).toBe(0)
    expect(dispatchBatchMock).not.toHaveBeenCalled()

    // Bugfix: o EmailLog "queued" preso pelo guard de domínio precisa ser
    // resolvido (não pode ficar "queued" para sempre).
    expect(markTeamEmailLogFailedMock).toHaveBeenCalledWith(
      "log-q",
      CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE
    )

    expect(emailCampaignUpdateMock).toHaveBeenCalled()
    const updateData = (emailCampaignUpdateMock.mock.calls[0] as unknown as [
      { data: { status?: string; errorMessage?: string } },
    ])[0].data
    expect(updateData.status).toBe("failed")
    expect(updateData.errorMessage).toBe(CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE)
    expect(emailCampaignDispatchUpdateMock).toHaveBeenCalled()

    // Bugfix: créditos reservados (1) precisam voltar pro time, já que
    // sentCount=0 (nenhum e-mail chegou a ser enviado pelo guard bloqueado).
    expect(releaseCreditsMock).toHaveBeenCalledWith("team-1", 1)
  })

  it("D13g — órfão sem logs queued restantes: incrementa totais e atualiza status do pai (regressão Mulheres 05)", async () => {
    emailCampaignDispatchFindManyMock.mockImplementation(async () => [
      {
        id: "dispatch-orphan-2",
        campaignId: "camp-child-2",
        teamId: "team-1",
        dispatchNumber: 1,
        batchIdempotencyScheme: "positional",
        templateHtml: "<p>Hi</p>",
        templateSubject: "S",
        totalRecipients: 287,
        triggeredBy: "profile-1",
        contactListId: "list-1",
        radarSegmentSlug: null,
        templateId: "tpl-1",
      },
    ])
    // Nenhum log "queued" restante — todos os destinatários já têm log terminal
    // (o envio real já saiu, só faltou consolidar o estado da campanha).
    emailLogFindManyMock.mockImplementation(async () => [])
    emailLogCountMock.mockImplementation(async (args: unknown) => {
      const where = (args as { where?: { sentAt?: unknown } })?.where
      if (where?.sentAt) return 269
      return 287
    })
    emailCampaignDispatchFindUniqueMock.mockImplementation(async () => ({
      triggeredBy: "profile-1",
      status: "sending" as const,
    }))
    emailCampaignUpdateMock.mockImplementationOnce(async () => ({
      parentCampaignId: "parent-1" as string | null,
    }))
    emailCampaignFindManyMock.mockImplementation(async () => [
      {
        status: "sent",
        totalSent: 296,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        dispatchCount: 1,
        sentAt: new Date("2026-08-05T21:32:00Z"),
      },
      {
        status: "sent",
        totalSent: 269,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        dispatchCount: 1,
        sentAt: new Date("2026-08-06T11:45:00Z"),
      },
      {
        status: "sent",
        totalSent: 293,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        dispatchCount: 1,
        sentAt: new Date("2026-08-07T12:25:00Z"),
      },
    ])

    const uc = new EmailCampaignUseCase()
    const resumed = await uc.resumeOrphanSendingDispatches({
      now: new Date("2026-08-11T12:41:00.000Z"),
    })

    expect(resumed).toBe(1)

    const campaignUpdateCalls = emailCampaignUpdateMock.mock.calls as unknown as Array<
      [{ where: { id: string }; data: Record<string, unknown> }]
    >

    // A sub-campanha órfã deve ter totalSent/dispatchCount incrementados, não zerados.
    const subCampaignUpdate = campaignUpdateCalls.find(
      (call) => call[0].where.id === "camp-child-2"
    )
    expect(subCampaignUpdate?.[0].data.status).toBe("partially_sent")
    expect(subCampaignUpdate?.[0].data.totalSent).toEqual({ increment: 269 })
    expect(subCampaignUpdate?.[0].data.dispatchCount).toEqual({ increment: 1 })

    // refreshParentCampaignStatus deve ter sido disparado para o pai — sem isso o pai
    // ficava travado em "scheduled" mesmo com todas as sub-campanhas enviadas.
    const parentUpdateCall = campaignUpdateCalls.find(
      (call) => call[0].where.id === "parent-1"
    )
    expect(parentUpdateCall?.[0].data.status).toBe("sent")
  })

  // --- Site consumer: processDispatchQueueBatch (Fase 4 / PR1) ---
  it("D13h — processDispatchQueueBatch bloqueado por domínio: resolve o EmailLog queued e libera créditos, sem republicar wake (bugfix: credit leak + reclaim loop)", async () => {
    // D13g deixou emailLogCountMock fixo em 269 (implementation não é resetada
    // por mockClear); zera aqui para countSuccessfulDispatchLogs refletir que
    // nenhum e-mail deste dispatch foi enviado antes do guard bloquear.
    emailLogCountMock.mockImplementation(async () => 0)
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => ({
      id: "dispatch-queue-1",
      campaignId: "camp-1",
      teamId: "team-1",
      dispatchNumber: 1,
      batchIdempotencyScheme: "positional",
      templateHtml: "<p>Hi</p>",
      templateSubject: "S",
      totalRecipients: 1,
      contactListId: "list-1",
      templateId: "tpl-1",
      reservedCredits: 1,
      hasCampaignsBetaAccess: false,
      createdAt: new Date(),
      status: "sending",
      campaign: { name: "Campanha Teste", status: "sending" },
    }))
    // 1ª chamada (lote lido pelo processDispatchQueueBatch) e 2ª chamada (1ª
    // iteração do while de failDispatchOnDomainGuard) ainda veem o log
    // "queued"; da 3ª em diante ele já foi resolvido — sem isso o while
    // nunca termina.
    let queuedLogFetches = 0
    emailLogFindManyMock.mockImplementation(async () => {
      queuedLogFetches += 1
      if (queuedLogFetches <= 2) {
        return [
          {
            id: "log-q2",
            recipientEmail: "r0@test.com",
            recipientName: "R0",
            status: "queued",
          },
        ]
      }
      return []
    })
    emailTeamSenderFindFirstMock.mockImplementation(async () => ({
      name: "Vendas",
      email: "vendas@empresaxyz.com.br",
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.processDispatchQueueBatch("dispatch-queue-1")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toBe(CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE)
    expect((output.result as { hasMore?: boolean } | null)?.hasMore).toBe(false)
    expect(dispatchBatchMock).not.toHaveBeenCalled()
    // Guard bloqueado é terminal — não deve republicar wake pra reprocessar o mesmo lote.
    expect(publishEmailCampaignDispatchWakeMock).not.toHaveBeenCalled()

    // Bugfix: o EmailLog "queued" preso pelo guard de domínio precisa ser
    // resolvido — sem isso ele fica "queued" pra sempre e
    // reclaimCompletedDispatchesWithQueuedLogs reabre o dispatch em loop.
    expect(markTeamEmailLogFailedMock).toHaveBeenCalledWith(
      "log-q2",
      CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE
    )

    expect(emailCampaignDispatchUpdateMock).toHaveBeenCalled()
    const dispatchUpdateData = (emailCampaignDispatchUpdateMock.mock.calls[0] as unknown as [
      { data: { status?: string } },
    ])[0].data
    expect(dispatchUpdateData.status).toBe("failed")

    // Bugfix: créditos reservados (1) precisam voltar pro time, já que
    // sentCount=0 (nenhum e-mail chegou a ser enviado pelo guard bloqueado).
    expect(releaseCreditsMock).toHaveBeenCalledWith("team-1", 1)
  })
})

// =============================================================================
// EmailCampaignUseCase.recoverStuckSendingCampaigns
// =============================================================================

describe("EmailCampaignUseCase.recoverStuckSendingCampaigns", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()
    transactionMock.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    releaseCreditsMock.mockImplementation(async () => {})
    captureMessageMock.mockClear()
  })

  it("campanha sem nenhum dispatch (órfã real) é revertida para draft, não failed", async () => {
    emailCampaignFindManyMock.mockImplementation(async () => [
      {
        id: "camp-orphan",
        name: "Sem dispatch",
        _count: { dispatches: 0 },
      },
    ])

    const uc = new EmailCampaignUseCase()
    const recovered = await uc.recoverStuckSendingCampaigns(new Date("2020-01-01T01:00:00.000Z"))

    expect(recovered).toBe(1)
    expect(emailCampaignUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["camp-orphan"] } },
        data: expect.objectContaining({ status: "draft" }),
      })
    )
    expect(emailCampaignDispatchFindFirstMock).not.toHaveBeenCalled()
    expect(captureMessageMock).not.toHaveBeenCalled()
  })

  it("dispatch sending com EmailLog queued pendente republica wake em vez de falhar (resiliência, incidente Lista Fria)", async () => {
    emailCampaignFindManyMock.mockImplementation(async () => [
      { id: "camp-in-progress", name: "Lista Fria", _count: { dispatches: 1 } },
    ])
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => ({
      id: "dispatch-in-progress",
      campaignId: "camp-in-progress",
      teamId: "team-1",
      totalRecipients: 60_646,
      reservedCredits: 60_646,
      hasCampaignsBetaAccess: false,
      materializeSourceOffset: 1500,
      createdAt: new Date("2019-12-31T00:00:00.000Z"),
    }))
    emailLogCountMock.mockImplementation(async () => 59_146)

    const uc = new EmailCampaignUseCase()
    const recovered = await uc.recoverStuckSendingCampaigns(new Date("2020-01-01T01:00:00.000Z"))

    expect(recovered).toBe(1)
    expect(publishEmailCampaignDispatchOverflowWakeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: "dispatch-in-progress",
        reason: "cron-reclaim",
        remainingCount: 59_146,
      })
    )
    expect(publishEmailCampaignDispatchWakeMock).not.toHaveBeenCalled()
    // Não deve tratar como falho enquanto ainda há trabalho na fila.
    expect(emailCampaignUpdateMock).not.toHaveBeenCalled()
    expect(captureMessageMock).not.toHaveBeenCalled()
  })

  it("dispatch sem queued restante e zero enviados vira failed de verdade e alerta no Sentry", async () => {
    emailCampaignFindManyMock.mockImplementation(async () => [
      { id: "camp-stuck", name: "Travada", _count: { dispatches: 1 } },
    ])
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => ({
      id: "dispatch-stuck",
      campaignId: "camp-stuck",
      teamId: "team-1",
      totalRecipients: 10,
      reservedCredits: 10,
      hasCampaignsBetaAccess: false,
      materializeSourceOffset: 10,
      createdAt: new Date("2019-12-31T00:00:00.000Z"),
    }))
    emailLogCountMock.mockImplementation(async (args: unknown) => {
      const where = (args as { where?: { status?: string; sentAt?: unknown } })?.where
      if (where?.status === "queued") return 0
      if (where?.sentAt) return 0
      return 10
    })
    emailCampaignUpdateMock.mockImplementation(async () => ({ parentCampaignId: null }))

    const uc = new EmailCampaignUseCase()
    const recovered = await uc.recoverStuckSendingCampaigns(new Date("2020-01-01T01:00:00.000Z"))

    expect(recovered).toBe(1)
    expect(publishEmailCampaignDispatchWakeMock).not.toHaveBeenCalled()
    expect(captureMessageMock).toHaveBeenCalledTimes(1)
    expect(captureMessageMock.mock.calls[0][0]).toContain("dispatch-stuck")
  })

  it("dispatch sem queued restante mas com envios reais reconcilia como partially_sent, não sobrescreve com failed", async () => {
    emailCampaignFindManyMock.mockImplementation(async () => [
      { id: "camp-partial", name: "Parcial", _count: { dispatches: 1 } },
    ])
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => ({
      id: "dispatch-partial",
      campaignId: "camp-partial",
      teamId: "team-1",
      totalRecipients: 10,
      reservedCredits: 10,
      hasCampaignsBetaAccess: false,
      materializeSourceOffset: 10,
      createdAt: new Date("2019-12-31T00:00:00.000Z"),
    }))
    emailLogCountMock.mockImplementation(async (args: unknown) => {
      const where = (args as { where?: { status?: string; sentAt?: unknown } })?.where
      if (where?.status === "queued") return 0
      if (where?.sentAt) return 7
      return 10
    })
    emailCampaignUpdateMock.mockImplementation(async () => ({ parentCampaignId: null }))

    const uc = new EmailCampaignUseCase()
    const recovered = await uc.recoverStuckSendingCampaigns(new Date("2020-01-01T01:00:00.000Z"))

    expect(recovered).toBe(1)
    expect(emailCampaignUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "partially_sent" }),
      })
    )
    expect(captureMessageMock).not.toHaveBeenCalled()
  })

  it("dispatch com queued 0 e materialização incompleta republica wake e não finaliza (review PR #908)", async () => {
    emailCampaignFindManyMock.mockImplementation(async () => [
      { id: "camp-lazy", name: "Lista Fria", _count: { dispatches: 1 } },
    ])
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => ({
      id: "dispatch-lazy",
      campaignId: "camp-lazy",
      teamId: "team-1",
      totalRecipients: 60_646,
      reservedCredits: 60_646,
      hasCampaignsBetaAccess: false,
      materializeSourceOffset: 500,
      createdAt: new Date("2019-12-31T00:00:00.000Z"),
    }))
    emailLogCountMock.mockImplementation(async (args: unknown) => {
      const where = (args as { where?: { status?: string; sentAt?: unknown } })?.where
      if (where?.status === "queued") return 0
      return 500
    })

    const uc = new EmailCampaignUseCase()
    const recovered = await uc.recoverStuckSendingCampaigns(new Date("2020-01-01T01:00:00.000Z"))

    expect(recovered).toBe(1)
    // `wakeBucket` é o que impede a chave `dispatchId:cron-reclaim` constante
    // de deduplicar por 24h e matar a recuperação pelo cron.
    expect(publishEmailCampaignDispatchOverflowWakeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchId: "dispatch-lazy",
        reason: "cron-reclaim",
        wakeBucket: expect.any(Number),
      })
    )
    expect(publishEmailCampaignDispatchWakeMock).not.toHaveBeenCalled()
    expect(emailCampaignUpdateMock).not.toHaveBeenCalled()
    expect(captureMessageMock).not.toHaveBeenCalled()
  })
})

describe("EmailCampaignUseCase.processDispatchQueueBatch — PR6 lock, overflow e cancel", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => makeSendingDispatch())
    queryRawUnsafeMock.mockImplementation(async () => [{ acquired: true }])
    pgQueryMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes("pg_try_advisory_lock")) {
        return { rows: [{ acquired: true }] }
      }
      return { rows: [] }
    })
    queryRawMock.mockImplementation(async () => [])
    installQueuedLogStore()
    emailLogFindManyMock.mockImplementation(async (args: unknown) => queuedLogFindManyImpl(args))
    emailLogCountMock.mockImplementation(async (args: unknown) => queuedLogCountImpl(args))
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => null)
    emailTeamSenderFindFirstMock.mockImplementation(async () => null)
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 0,
      failed: 0,
      dispatched: [],
      providerErrors: [],
    }))
    setupTemplateMock()
    restoreRadarRecipientPageMock()
    buildCampaignDispatchInputMock.mockImplementation(async () => makeDefaultDispatchInput([]))
    findUnresolvedTokensMock.mockImplementation(() => [])
    listActiveRecipientsMock.mockImplementation(async () => [])
    findTeamBlocklistedEmailsMock.mockImplementation(async () => new Set<string>())
  })

  it("lock ocupado: ack sem chamar Resend", async () => {
    pgQueryMock.mockImplementation(async () => ({ rows: [{ acquired: false }] }))
    const uc = new EmailCampaignUseCase()
    const output = await uc.processDispatchQueueBatch("dispatch-1")
    expect(output.isValid).toBe(true)
    expect((output.result as { skipped?: boolean } | null)?.skipped).toBe(true)
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  it("campanha cancelada: ack sem Resend", async () => {
    emailCampaignDispatchFindFirstMock.mockImplementation(async () =>
      makeSendingDispatch({
        campaign: {
          name: "Campanha Teste",
          status: "canceled",
          audienceContactIds: [],
          contactListId: "list-1",
          radarSegmentSlug: null,
        },
      })
    )
    const uc = new EmailCampaignUseCase()
    const output = await uc.processDispatchQueueBatch("dispatch-1")
    expect(output.isValid).toBe(true)
    expect((output.result as { skipped?: boolean } | null)?.skipped).toBe(true)
    expect(dispatchBatchMock).not.toHaveBeenCalled()
  })

  it("idade >= 30 min republica continue na overflow", async () => {
    const recipients = makeRecipients(3)
    persistDispatchSourceOffset(
      makeSendingDispatch({
        totalRecipients: 3,
        reservedCredits: 3,
        createdAt: new Date(Date.now() - 31 * 60 * 1000),
      })
    )
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(recipients)
    )
    dispatchBatchMock.mockImplementation(
      autoChunkDispatched({
        sent: 2,
        failed: 0,
        dispatched: recipients.slice(0, 2).map((recipient) => ({
          email: recipient.email,
          resendId: `re_${recipient.email}`,
        })),
        providerErrors: [],
      })
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.processDispatchQueueBatch("dispatch-1", { batchSize: 2 })
    expect(output.isValid).toBe(true)
    expect((output.result as { hasMore?: boolean } | null)?.hasMore).toBe(true)
    expect(publishEmailCampaignDispatchOverflowWakeMock).toHaveBeenCalledWith(
      expect.objectContaining({ dispatchId: "dispatch-1", reason: "continue" })
    )
    expect(publishEmailCampaignDispatchWakeMock).not.toHaveBeenCalled()
  })
})

// =============================================================================
// EmailCampaignUseCase.dispatchScheduledCampaigns
// =============================================================================

describe("EmailCampaignUseCase.dispatchScheduledCampaigns", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()
    emailCampaignFindManyMock.mockImplementation(async () => [])
    emailCampaignUpdateManyMock.mockImplementation(async () => ({ count: 0 }))
    emailCampaignDispatchUpdateManyMock.mockImplementation(async () => ({ count: 0 }))
    transactionMock.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    processPendingBatchMock.mockImplementation(async () => ({
      processed: 0,
      failed: 0,
      skipped: 0,
    }))
  })

  it("C11 — processPendingBatch chamado 1× após o loop de campanhas", async () => {
    // Sem campanhas agendadas; apenas verifica que o orphan sweep ocorre
    processPendingBatchMock.mockImplementation(async () => ({
      processed: 3,
      failed: 0,
      skipped: 0,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.dispatchScheduledCampaigns({ maxCampaigns: 5 })

    expect(processPendingBatchMock).toHaveBeenCalledTimes(1)
    expect(output.isValid).toBe(true)
    expect(output.result.dispatched).toBe(0)
  })
})

// =============================================================================
// Contratos de constantes (mantidos dos testes originais)
// =============================================================================

describe("EMAIL_CAMPAIGN_FAILURE_MESSAGES (contratos)", () => {
  it("NO_CREDITS contém 'créditos'", () => {
    expect(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_CREDITS).toContain("créditos")
  })

  it("NO_RECIPIENTS_LIST contém 'contato'", () => {
    expect(EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_LIST).toContain("contato")
  })

  it("ALL_SUPPRESSED referencia cancelamento por supressão total", () => {
    expect(EMAIL_CAMPAIGN_FAILURE_MESSAGES.ALL_SUPPRESSED).toContain("bounce")
  })

  it("INTERNAL é a copy amigável e não contém 'Erro interno'", () => {
    expect(EMAIL_CAMPAIGN_FAILURE_MESSAGES.INTERNAL).toBe("Ocorreu um erro ao disparar a campanha")
    expect(EMAIL_CAMPAIGN_FAILURE_MESSAGES.INTERNAL).not.toContain("Erro interno")
  })
})

describe("EmailCampaignUseCase.previewPlan", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()
  })

  it("retorna erro quando nome está vazio", async () => {
    const uc = new EmailCampaignUseCase()
    const output = await uc.previewPlan(
      { name: "", templateId: "00000000-0000-4000-8000-000000000001" },
      teamCtx
    )
    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("Nome")
  })

  it("exige estratégia quando há múltiplas listas", async () => {
    const uc = new EmailCampaignUseCase()
    const output = await uc.previewPlan(
      {
        name: "Multi",
        templateId: "00000000-0000-4000-8000-000000000001",
        contactListIds: [
          "00000000-0000-4000-8000-000000000001",
          "00000000-0000-4000-8000-000000000002",
        ],
      },
      teamCtx
    )
    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("estratégia")
  })

  it("aceita preview com lista e segmento juntos (não rejeita por XOR)", async () => {
    const uc = new EmailCampaignUseCase()
    const both = await uc.previewPlan(
      {
        name: "Combo",
        templateId: "00000000-0000-4000-8000-000000000001",
        contactListId: "00000000-0000-4000-8000-000000000001",
        radarSegmentSlug: "email_marketable",
      },
      teamCtx
    )
    expect(both.errorMessages.join(" ")).not.toContain("não ambos")
  })

  // Ticket 06 — wizard não detecta split acima de 2.000 porque previewPlan
  // valida agendamento cedo demais (uniformSchedule:false + schedules vazios).
  // previewPlan é descoberta: deve devolver o plano dividido sem exigir horários.
  it("06-A — audiência 3.445 (uniformSchedule:false, schedules vazios) revela 2 sub-campanhas", async () => {
    listActiveRecipientsMock.mockImplementation(async () => makeRecipients(3445))

    const uc = new EmailCampaignUseCase()
    const output = await uc.previewPlan(
      {
        name: "Grande",
        templateId: "00000000-0000-4000-8000-000000000001",
        contactListId: "00000000-0000-4000-8000-000000000001",
        uniformSchedule: false,
        subCampaignSchedules: [],
      },
      teamCtx
    )

    expect(output.isValid).toBe(true)
    const result = output.result as { subCampaigns: unknown[] }
    expect(result.subCampaigns.length).toBe(2)
  })

  it("inclui contagens split de bounce, descadastro e reclamação no preview de lista", async () => {
    listActiveRecipientsMock.mockImplementation(async () => makeRecipients(100))
    countSuppressedRecipientsForListsMock.mockImplementation(async () => ({
      bounced: 7,
      unsubscribed: 3,
      complained: 2,
      total: 12,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.previewPlan(
      {
        name: "Com suprimidos",
        templateId: "00000000-0000-4000-8000-000000000001",
        contactListId: "00000000-0000-4000-8000-000000000001",
      },
      teamCtx
    )

    expect(output.isValid).toBe(true)
    const result = output.result as {
      suppressedExcludedCount?: number
      bouncedExcludedCount?: number
      unsubscribedExcludedCount?: number
      complainedExcludedCount?: number
    }
    expect(result.suppressedExcludedCount).toBe(12)
    expect(result.bouncedExcludedCount).toBe(7)
    expect(result.unsubscribedExcludedCount).toBe(3)
    expect(result.complainedExcludedCount).toBe(2)
  })
})

describe("EmailCampaignUseCase.create — gate de agendamento (ticket 06)", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()
    setupTemplateMock()
  })

  // Contraparte do 06-A: a validação de completude de agendamento continua no
  // create. Mesma entrada que passa no preview deve bloquear a criação.
  it("06-B — audiência 3.445 sem horários por sub-campanha → bloqueia criação", async () => {
    listActiveRecipientsMock.mockImplementation(async () => makeRecipients(3445))

    const uc = new EmailCampaignUseCase()
    const output = await uc.create(
      {
        name: "Grande",
        templateId: "00000000-0000-4000-8000-000000000001",
        contactListId: "00000000-0000-4000-8000-000000000001",
        uniformSchedule: false,
        subCampaignSchedules: [],
      },
      teamCtx
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toContain("Informe uma data para cada sub-campanha")
  })
})


type MockWhereArgs = { where?: { parentCampaignId?: unknown; status?: unknown; teamId?: string; dispatchId?: unknown; id?: string } }

// =============================================================================
// Dispatch progress contract (campaign-dispatch-ui-feedback)
// =============================================================================

describe("EmailCampaignUseCase dispatch progress", () => {
  beforeEach(() => {
    for (const m of allMocks) m.mockClear()
    emailCampaignFindFirstMock.mockImplementation(async () => makeCampaign())
    emailCampaignFindManyMock.mockImplementation(async () => [])
    emailCampaignCountMock.mockImplementation(async () => 0)
    emailCampaignGroupByMock.mockImplementation(async () => [])
    emailCampaignUpdateManyMock.mockImplementation(async () => ({ count: 1 }))
    emailCampaignUpdateMock.mockImplementation(async () => ({ parentCampaignId: null }))
    emailCampaignDispatchAggregateMock.mockImplementation(async () => ({
      _max: { dispatchNumber: 0 },
    }))
    emailCampaignDispatchCreateMock.mockImplementation(async () => ({ id: "dispatch-1" }))
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => ({ id: "dispatch-1" }))
    emailCampaignDispatchFindManyMock.mockImplementation(async () => [])
    emailCampaignDispatchUpdateMock.mockImplementation(async () => ({}))
    emailLogFindManyMock.mockImplementation(async () => [])
    queryRawMock.mockImplementation(async () => [])
    profileFindManyMock.mockImplementation(async () => [])
    transactionMock.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops))
    reserveCreditsMock.mockImplementation(async () => ({ ok: true as const }))
    releaseCreditsMock.mockImplementation(async () => {})
    resolveEmailBetaAccessMock.mockImplementation(async () => false)
    resolveRadarBetaAccessMock.mockImplementation(async () => true)
    listActiveRecipientsMock.mockImplementation(async () => [])
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(2))
    )
    findUnresolvedTokensMock.mockImplementation(() => [])
    createQueuedLogsMock.mockImplementation(
      async (inputs: Array<{ recipientEmail: string }>) =>
        inputs.map((i) => ({ email: i.recipientEmail, logId: `log-${i.recipientEmail}` }))
    )
    emailTeamSettingsFindUniqueMock.mockImplementation(async () => null)
    emailTeamSenderFindFirstMock.mockImplementation(async () => null)
    setupTemplateMock()
  })

  it("list retorna activeDispatch para campanha sending", async () => {
    emailCampaignFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where && "parentCampaignId" in (whereArgs.where ?? {}) && whereArgs.where.parentCampaignId != null) {
        return []
      }
      return [
        {
          id: "camp-1",
          name: "Campanha Enviando",
          status: "sending",
          scheduledAt: null,
          sentAt: null,
          totalRecipients: 10,
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          dispatchCount: 1,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          createdBy: "profile-1",
          managedByBackofficeUserId: null,
          templateId: "tpl-1",
          contactListId: "list-1",
          radarSegmentSlug: null,
          audienceContactIds: ["c1"],
          errorMessage: null,
          _count: { subCampaigns: 0 },
        },
      ]
    })
    emailCampaignCountMock.mockImplementation(async () => 1)
    emailCampaignDispatchFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") {
        return [
          {
            id: "dispatch-active",
            campaignId: "camp-1",
            dispatchNumber: 1,
            status: "sending",
            totalRecipients: 10,
            retryFailedOnly: false,
            errorMessage: null,
            updatedAt: new Date("2026-01-01T00:01:00.000Z"),
          },
        ]
      }
      return []
    })
    mockLogCounterAggregation([
      { dispatchId: "dispatch-active", status: "sent", sentAt: new Date(), resendEmailId: "re_1" },
      { dispatchId: "dispatch-active", status: "queued", sentAt: null, resendEmailId: null },
      { dispatchId: "dispatch-active", status: "failed", sentAt: null, resendEmailId: null },
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.list(teamCtx, { page: 1, pageSize: 20 })

    expect(output.isValid).toBe(true)
    const campaign = (output.result as { campaigns: Array<Record<string, unknown>> }).campaigns[0]
    expect(campaign.activeDispatch).toMatchObject({
      dispatchId: "dispatch-active",
      status: "sending",
      completionKind: "pending",
      acceptedCount: 1,
      queuedCount: 1,
      failedCount: 1,
      totalRecipients: 10,
      retryFailedOnly: false,
    })
  })

  it("list corrige status failed divergente quando os EmailLog mostram 100% de aceite (regressão Mulheres)", async () => {
    emailCampaignFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where && "parentCampaignId" in (whereArgs.where ?? {}) && whereArgs.where.parentCampaignId != null) {
        return []
      }
      return [
        {
          id: "camp-mulheres",
          name: "Mulheres",
          status: "failed",
          scheduledAt: null,
          sentAt: null,
          totalRecipients: 2211,
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          dispatchCount: 1,
          createdAt: new Date("2026-08-11T14:03:00.000Z"),
          createdBy: "profile-1",
          managedByBackofficeUserId: null,
          templateId: "tpl-1",
          contactListId: "list-1",
          radarSegmentSlug: null,
          audienceContactIds: ["c1"],
          errorMessage: "Erro interno durante o disparo",
          _count: { subCampaigns: 0 },
        },
      ]
    })
    emailCampaignCountMock.mockImplementation(async () => 1)
    // EmailLog real mostra que os 2211 destinatários foram aceitos pelo provedor
    // (via webhook), apesar do registro interno de status ter ficado em "failed".
    emailLogFindManyMock.mockImplementation(async () =>
      Array.from({ length: 2211 }, (_, i) => ({
        campaignId: "camp-mulheres",
        recipientEmail: `r${i}@test.com`,
        status: "delivered",
        sentAt: new Date("2026-08-11T14:05:00.000Z"),
        resendEmailId: `re_${i}`,
      }))
    )

    const uc = new EmailCampaignUseCase()
    const output = await uc.list(teamCtx, { page: 1, pageSize: 20 })

    expect(output.isValid).toBe(true)
    const campaign = (output.result as { campaigns: Array<Record<string, unknown>> }).campaigns[0]
    expect(campaign.status).toBe("sent")
    expect(campaign.totalSent).toBe(2211)
    expect(campaign.errorMessage).toBeNull()

    // Persistiu a correção no banco, não só na resposta.
    const campaignUpdateCalls = emailCampaignUpdateMock.mock.calls as unknown as Array<
      [{ where: { id: string }; data: Record<string, unknown> }]
    >
    const reconcileUpdate = campaignUpdateCalls.find(
      (call) => call[0].where.id === "camp-mulheres"
    )
    expect(reconcileUpdate?.[0].data.status).toBe("sent")
    expect(reconcileUpdate?.[0].data.totalSent).toBe(2211)
    // sentAt deve refletir o horário real do envio (log), não o momento da leitura.
    expect((reconcileUpdate?.[0].data.sentAt as Date).toISOString()).toBe(
      "2026-08-11T14:05:00.000Z"
    )
  })

  it("list NÃO reconcilia campanha terminal sem nenhum EmailLog (evita falso-positivo de falha)", async () => {
    emailCampaignFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where && "parentCampaignId" in (whereArgs.where ?? {}) && whereArgs.where.parentCampaignId != null) {
        return []
      }
      return [
        {
          id: "camp-legado-sem-logs",
          name: "Campanha Legada",
          status: "sent",
          scheduledAt: null,
          sentAt: new Date("2025-01-01T00:00:00.000Z"),
          totalRecipients: 500,
          totalSent: 500,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          dispatchCount: 1,
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
          createdBy: "profile-1",
          managedByBackofficeUserId: null,
          templateId: "tpl-1",
          contactListId: "list-1",
          radarSegmentSlug: null,
          audienceContactIds: ["c1"],
          errorMessage: null,
          _count: { subCampaigns: 0 },
        },
      ]
    })
    emailCampaignCountMock.mockImplementation(async () => 1)
    // Dispatch de backfill sem nenhum EmailLog associado (ex.: campanha migrada de
    // um sistema antigo). Sem evidência de log, o status persistido deve prevalecer.
    emailLogFindManyMock.mockImplementation(async () => [])

    const uc = new EmailCampaignUseCase()
    const output = await uc.list(teamCtx, { page: 1, pageSize: 20 })

    expect(output.isValid).toBe(true)
    const campaign = (output.result as { campaigns: Array<Record<string, unknown>> }).campaigns[0]
    expect(campaign.status).toBe("sent")
    expect(campaign.totalSent).toBe(500)

    const campaignUpdateCalls = emailCampaignUpdateMock.mock.calls as unknown as Array<
      [{ where: { id: string }; data: Record<string, unknown> }]
    >
    expect(
      campaignUpdateCalls.some((call) => call[0].where.id === "camp-legado-sem-logs")
    ).toBe(false)
  })

  it("startManualDispatch persiste retryFailedOnly true quando solicitado", async () => {
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ status: "failed" })
    )
    emailLogFindManyMock.mockImplementation(async () => [
      { recipientEmail: "r0@test.com", status: "failed" },
      { recipientEmail: "r1@test.com", status: "failed" },
    ])
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 2,
      failed: 0,
      dispatched: [
        { email: "r0@test.com", resendId: "re_0" },
        { email: "r1@test.com", resendId: "re_1" },
      ],
      providerErrors: [],
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx, { retryFailedOnly: true })

    expect(output.isValid).toBe(true)
    expect(emailCampaignDispatchCreateMock).toHaveBeenCalled()
    const createArg = emailCampaignDispatchCreateMock.mock.calls[0] as unknown as [
      { data: { retryFailedOnly?: boolean } },
    ]
    expect(createArg[0].data.retryFailedOnly).toBe(true)
  })

  it("startManualDispatch persiste retryFailedOnly false no envio normal", async () => {
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 2,
      failed: 0,
      dispatched: [
        { email: "r0@test.com", resendId: "re_0" },
        { email: "r1@test.com", resendId: "re_1" },
      ],
      providerErrors: [],
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    const createArg = emailCampaignDispatchCreateMock.mock.calls[0] as unknown as [
      { data: { retryFailedOnly?: boolean } },
    ]
    expect(createArg[0].data.retryFailedOnly).toBe(false)
  })

  it("startManualDispatch usa o templateId pinado da campanha, não promove isCurrentPublished", async () => {
    let call = 0
    emailTemplateFindFirstMock.mockImplementation(async () => {
      call += 1
      if (call === 1) {
        return {
          id: "tpl-ref-1",
          name: "Template v1",
          subject: "Assunto v1",
          html: "<p>versão 1</p>",
          variables: [],
          versionNumber: 1,
          versionGroupId: "vg-1",
        }
      }
      return {
        id: "tpl-current",
        name: "Template v2",
        subject: "Assunto v2",
        html: "<p>versão 2</p>",
        variables: [],
        versionNumber: 2,
      }
    })
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 2,
      failed: 0,
      dispatched: [
        { email: "r0@test.com", resendId: "re_0" },
        { email: "r1@test.com", resendId: "re_1" },
      ],
      providerErrors: [],
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    expect(call).toBe(1)
    const createArg = emailCampaignDispatchCreateMock.mock.calls[0] as unknown as [
      { data: { templateId?: string; templateVersionNumber?: number; templateHtml?: string } },
    ]
    expect(createArg[0].data.templateId).toBe("tpl-ref-1")
    expect(createArg[0].data.templateVersionNumber).toBe(1)
    expect(createArg[0].data.templateHtml).toContain("versão 1")
  })

  it("startManualDispatch cai no current published se o template pinado foi arquivado", async () => {
    let call = 0
    emailTemplateFindFirstMock.mockImplementation(async () => {
      call += 1
      if (call === 1) return null
      if (call === 2) return { versionGroupId: "vg-1" }
      return {
        id: "tpl-current",
        name: "Template v2",
        subject: "Assunto v2",
        html: "<p>versão 2</p>",
        variables: [],
        versionNumber: 2,
      }
    })
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 2,
      failed: 0,
      dispatched: [
        { email: "r0@test.com", resendId: "re_0" },
        { email: "r1@test.com", resendId: "re_1" },
      ],
      providerErrors: [],
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    const createArg = emailCampaignDispatchCreateMock.mock.calls[0] as unknown as [
      { data: { templateId?: string; templateVersionNumber?: number } },
    ]
    expect(createArg[0].data.templateId).toBe("tpl-current")
    expect(createArg[0].data.templateVersionNumber).toBe(2)
  })

  it("failed com totalSent 0 sem flag não força retryFailedOnly (primeiro Disparar)", async () => {
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ status: "failed", totalSent: 0 })
    )
    emailLogFindManyMock.mockImplementation(async () => [
      { recipientEmail: "r0@test.com", status: "failed" },
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    const createArg = emailCampaignDispatchCreateMock.mock.calls[0] as unknown as [
      { data: { retryFailedOnly?: boolean; totalRecipients?: number } },
    ]
    expect(createArg[0].data.retryFailedOnly).toBe(false)
    expect((reserveCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(2)
  })

  it("failed com totalSent > 0 sem flag ainda força retryFailedOnly", async () => {
    emailCampaignFindFirstMock.mockImplementation(async () =>
      makeCampaign({ status: "failed", totalSent: 3 })
    )
    emailLogFindManyMock.mockImplementation(async () => [
      { recipientEmail: "r0@test.com", status: "failed" },
      { recipientEmail: "r1@test.com", status: "sent" },
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.startManualDispatch("camp-1", teamCtx)

    expect(output.isValid).toBe(true)
    const createArg = emailCampaignDispatchCreateMock.mock.calls[0] as unknown as [
      { data: { retryFailedOnly?: boolean } },
    ]
    expect(createArg[0].data.retryFailedOnly).toBe(true)
    expect((reserveCreditsMock.mock.calls[0] as unknown as [string, number])[1]).toBe(1)
  })

  it("list retorna latestDispatch para campanha failed com erro", async () => {
    emailCampaignFindManyMock.mockImplementation(async () => [
      {
        id: "camp-failed",
        name: "Falhou",
        status: "failed",
        scheduledAt: null,
        sentAt: null,
        totalRecipients: 5,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        dispatchCount: 1,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        createdBy: "profile-1",
        managedByBackofficeUserId: null,
        templateId: "tpl-1",
        contactListId: "list-1",
        radarSegmentSlug: null,
        audienceContactIds: ["c1"],
        errorMessage: "Erro Resend",
        _count: { subCampaigns: 0 },
      },
    ])
    emailCampaignCountMock.mockImplementation(async () => 1)
    emailCampaignDispatchFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") return []
      return [
        {
          id: "dispatch-failed",
          campaignId: "camp-failed",
          dispatchNumber: 1,
          status: "failed",
          totalRecipients: 5,
          retryFailedOnly: false,
          errorMessage: "Erro Resend",
          updatedAt: new Date("2026-01-01T00:02:00.000Z"),
        },
      ]
    })
    mockLogCounterAggregation([
      { dispatchId: "dispatch-failed", status: "failed", sentAt: null, resendEmailId: null },
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.list(teamCtx, { page: 1, pageSize: 20 })
    const campaign = (output.result as { campaigns: Array<Record<string, unknown>> }).campaigns[0]
    expect(campaign.activeDispatch).toBeNull()
    expect(campaign.latestDispatch).toMatchObject({
      dispatchId: "dispatch-failed",
      status: "failed",
      completionKind: "failed",
      acceptedCount: 0,
      failedCount: 1,
      errorMessage: "Erro Resend",
    })
  })

  it("getById retorna progresso de subcampanha em sending", async () => {
    emailCampaignFindFirstMock.mockImplementation(async () => ({
      ...makeCampaign({ id: "parent-1", status: "partially_sent" }),
      description: null,
      sourceContactListIds: [],
      audienceContactIds: [],
      managedByBackofficeUserId: null,
      dispatchCount: 1,
      totalRecipients: 20,
      totalSent: 5,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      scheduledAt: null,
      sentAt: null,
      createdBy: "profile-1",
      errorMessage: null,
      template: { id: "tpl-1", name: "T", subject: "S" },
      contactList: { id: "list-1", name: "T", totalContacts: 10 },
      subCampaigns: [
        {
          id: "sub-sending",
          name: "Parte 1",
          description: null,
          status: "sending",
          scheduledAt: null,
          sentAt: null,
          totalRecipients: 10,
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          subCampaignIndex: 0,
          contactListId: "list-1",
          templateId: "tpl-1",
          errorMessage: null,
        },
        {
          id: "sub-sent",
          name: "Parte 2",
          description: null,
          status: "sent",
          scheduledAt: null,
          sentAt: new Date(),
          totalRecipients: 10,
          totalSent: 10,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          subCampaignIndex: 1,
          contactListId: "list-2",
          templateId: "tpl-1",
          errorMessage: null,
        },
      ],
    }))
    emailCampaignDispatchFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") {
        return [
          {
            id: "dispatch-sub",
            campaignId: "sub-sending",
            dispatchNumber: 1,
            status: "sending",
            totalRecipients: 10,
            retryFailedOnly: false,
            errorMessage: null,
            updatedAt: new Date("2026-01-01T00:01:00.000Z"),
          },
        ]
      }
      return [
        {
          id: "dispatch-sub-done",
          campaignId: "sub-sent",
          dispatchNumber: 1,
          status: "completed",
          totalRecipients: 10,
          retryFailedOnly: false,
          errorMessage: null,
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]
    })
    mockLogCounterAggregation([
      { dispatchId: "dispatch-sub", status: "sent", sentAt: new Date(), resendEmailId: "re_1" },
      { dispatchId: "dispatch-sub", status: "queued", sentAt: null, resendEmailId: null },
      {
        dispatchId: "dispatch-sub-done",
        status: "delivered",
        sentAt: new Date(),
        resendEmailId: "re_2",
      },
    ])
    emailLogFindManyMock.mockImplementation(async () => [
      {
        campaignId: "sub-sending",
        recipientEmail: "a@test.com",
        status: "sent",
        sentAt: new Date(),
        resendEmailId: "re_1",
      },
      {
        campaignId: "sub-sending",
        recipientEmail: "b@test.com",
        status: "queued",
        sentAt: null,
        resendEmailId: null,
      },
      {
        campaignId: "sub-sent",
        recipientEmail: "c@test.com",
        status: "delivered",
        sentAt: new Date(),
        resendEmailId: "re_2",
      },
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.getById("parent-1", teamCtx)
    expect(output.isValid).toBe(true)
    const result = output.result as {
      subCampaigns: Array<Record<string, unknown>>
      dispatchProgressSummary: Record<string, unknown> | null
    }
    expect(result.subCampaigns[0].activeDispatch).toMatchObject({
      dispatchId: "dispatch-sub",
      status: "sending",
      completionKind: "pending",
      acceptedCount: 1,
      queuedCount: 1,
    })
    expect(result.dispatchProgressSummary).toMatchObject({
      activeDispatchCount: 1,
      completionKind: "pending",
      acceptedCount: 2,
    })
  })

  it("partiallySentCount conta sub-campanhas 'partially_sent' como concluídas, não só 'sent'", async () => {
    emailCampaignFindFirstMock.mockImplementation(async () => ({
      ...makeCampaign({ id: "parent-2", status: "partially_sent" }),
      description: null,
      sourceContactListIds: [],
      audienceContactIds: [],
      managedByBackofficeUserId: null,
      dispatchCount: 2,
      totalRecipients: 20,
      totalSent: 15,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      scheduledAt: null,
      sentAt: null,
      createdBy: "profile-1",
      errorMessage: null,
      template: { id: "tpl-1", name: "T", subject: "S" },
      contactList: { id: "list-1", name: "T", totalContacts: 10 },
      subCampaigns: [
        {
          id: "sub-sent",
          name: "Parte 1",
          description: null,
          status: "sent",
          scheduledAt: null,
          sentAt: new Date(),
          totalRecipients: 10,
          totalSent: 10,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          subCampaignIndex: 0,
          contactListId: "list-1",
          templateId: "tpl-1",
          errorMessage: null,
        },
        {
          id: "sub-partial",
          name: "Parte 2",
          description: null,
          status: "partially_sent",
          scheduledAt: null,
          sentAt: new Date(),
          totalRecipients: 10,
          totalSent: 5,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          subCampaignIndex: 1,
          contactListId: "list-2",
          templateId: "tpl-1",
          errorMessage: "Limite mensal de envios do provedor atingido",
        },
      ],
    }))
    emailCampaignDispatchFindManyMock.mockImplementation(async () => [])
    mockLogCounterAggregation([])
    emailLogFindManyMock.mockImplementation(async () => [])

    const uc = new EmailCampaignUseCase()
    const output = await uc.getById("parent-2", teamCtx)
    expect(output.isValid).toBe(true)
    const result = output.result as {
      partiallySentCount?: number
      partiallySentTotal?: number
    }
    // "sub-sent" (sent) + "sub-partial" (partially_sent) contam como concluídas:
    // uma sub-campanha que abortou por limite de quota, mas enviou parte,
    // não pode aparecer como "não concluída" no resumo "X de Y partes enviadas".
    expect(result.partiallySentCount).toBe(2)
    expect(result.partiallySentTotal).toBe(2)
  })

  it("agregação diferencia queued/accepted/failed e não reduz aceite após delivered/opened", async () => {
    emailCampaignFindManyMock.mockImplementation(async () => [
      {
        id: "camp-1",
        name: "Camp",
        status: "sending",
        scheduledAt: null,
        sentAt: null,
        totalRecipients: 4,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        dispatchCount: 1,
        createdAt: new Date(),
        createdBy: "profile-1",
        managedByBackofficeUserId: null,
        templateId: "tpl-1",
        contactListId: "list-1",
        radarSegmentSlug: null,
        audienceContactIds: ["c1"],
        errorMessage: null,
        _count: { subCampaigns: 0 },
      },
    ])
    emailCampaignCountMock.mockImplementation(async () => 1)
    emailCampaignDispatchFindManyMock.mockImplementation(async () => [
      {
        id: "dispatch-1",
        campaignId: "camp-1",
        dispatchNumber: 1,
        status: "sending",
        totalRecipients: 4,
        retryFailedOnly: false,
        errorMessage: null,
        updatedAt: new Date(),
      },
    ])
    mockLogCounterAggregation([
      { dispatchId: "dispatch-1", status: "queued", sentAt: null, resendEmailId: null },
      { dispatchId: "dispatch-1", status: "failed", sentAt: null, resendEmailId: null },
      { dispatchId: "dispatch-1", status: "delivered", sentAt: new Date(), resendEmailId: "re_1" },
      { dispatchId: "dispatch-1", status: "opened", sentAt: new Date(), resendEmailId: "re_2" },
      { dispatchId: "dispatch-1", status: "bounced", sentAt: new Date(), resendEmailId: "re_3" },
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.list(teamCtx, { page: 1, pageSize: 20 })
    const campaign = (output.result as { campaigns: Array<Record<string, unknown>> }).campaigns[0]
    expect(campaign.activeDispatch).toMatchObject({
      acceptedCount: 3,
      failedCount: 1,
      queuedCount: 1,
    })
  })

  it("dispatch completed com acceptedCount < totalRecipients → completionKind partial", async () => {
    emailCampaignFindManyMock.mockImplementation(async () => [
      {
        id: "camp-partial",
        name: "Parcial",
        status: "sent",
        scheduledAt: null,
        sentAt: new Date(),
        totalRecipients: 10,
        totalSent: 7,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        dispatchCount: 1,
        createdAt: new Date(),
        createdBy: "profile-1",
        managedByBackofficeUserId: null,
        templateId: "tpl-1",
        contactListId: "list-1",
        radarSegmentSlug: null,
        audienceContactIds: ["c1"],
        errorMessage: null,
        _count: { subCampaigns: 0 },
      },
    ])
    emailCampaignCountMock.mockImplementation(async () => 1)
    emailCampaignDispatchFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") return []
      return [
        {
          id: "dispatch-partial",
          campaignId: "camp-partial",
          dispatchNumber: 1,
          status: "completed",
          totalRecipients: 10,
          retryFailedOnly: false,
          errorMessage: null,
          updatedAt: new Date(),
        },
      ]
    })
    mockLogCounterAggregation([
      ...Array.from({ length: 7 }, (_, i) => ({
        dispatchId: "dispatch-partial",
        status: "sent",
        sentAt: new Date(),
        resendEmailId: `re_${i}`,
      })),
      ...Array.from({ length: 3 }, () => ({
        dispatchId: "dispatch-partial",
        status: "failed",
        sentAt: null as Date | null,
        resendEmailId: null as string | null,
      })),
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.list(teamCtx, { page: 1, pageSize: 20 })
    const campaign = (output.result as { campaigns: Array<Record<string, unknown>> }).campaigns[0]
    expect(campaign.latestDispatch).toMatchObject({
      status: "completed",
      completionKind: "partial",
      acceptedCount: 7,
      failedCount: 3,
    })
    expect((campaign.latestDispatch as { status: string }).status).not.toBe("partially_completed")
  })

  it("list retorna dispatchProgressSummary para campanha-pai com sub em sending", async () => {
    let findManyCalls = 0
    emailCampaignFindManyMock.mockImplementation(async () => {
      findManyCalls += 1
      if (findManyCalls === 1) {
        return [
          {
            id: "parent-1",
            name: "Pai",
            status: "partially_sent",
            scheduledAt: null,
            sentAt: null,
            totalRecipients: 20,
            totalSent: 0,
            totalDelivered: 0,
            totalOpened: 0,
            totalClicked: 0,
            totalBounced: 0,
            dispatchCount: 0,
            createdAt: new Date(),
            createdBy: "profile-1",
            managedByBackofficeUserId: null,
            templateId: "tpl-1",
            contactListId: null,
            radarSegmentSlug: null,
            audienceContactIds: [],
            errorMessage: null,
            _count: { subCampaigns: 2 },
          },
        ]
      }
      // children for progress
      return [
        { id: "sub-1", status: "sending", parentCampaignId: "parent-1", totalRecipients: 10 },
        { id: "sub-2", status: "sent", parentCampaignId: "parent-1", totalRecipients: 10 },
      ]
    })
    emailCampaignCountMock.mockImplementation(async () => 1)
    emailCampaignGroupByMock.mockImplementation(async () => [
      {
        parentCampaignId: "parent-1",
        _sum: {
          totalSent: 5,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          dispatchCount: 1,
        },
      },
    ])
    emailCampaignDispatchFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") {
        return [
          {
            id: "dispatch-child",
            campaignId: "sub-1",
            dispatchNumber: 1,
            status: "sending",
            totalRecipients: 10,
            retryFailedOnly: false,
            errorMessage: null,
            updatedAt: new Date(),
          },
        ]
      }
      return [
        {
          id: "dispatch-child-done",
          campaignId: "sub-2",
          dispatchNumber: 1,
          status: "completed",
          totalRecipients: 10,
          retryFailedOnly: false,
          errorMessage: null,
          updatedAt: new Date(),
        },
      ]
    })
    mockLogCounterAggregation([
      { dispatchId: "dispatch-child", status: "sent", sentAt: new Date(), resendEmailId: "re_1" },
      {
        dispatchId: "dispatch-child-done",
        status: "delivered",
        sentAt: new Date(),
        resendEmailId: "re_2",
      },
    ])
    emailLogFindManyMock.mockImplementation(async () => [
      {
        campaignId: "sub-1",
        recipientEmail: "a@test.com",
        status: "sent",
        sentAt: new Date(),
        resendEmailId: "re_1",
      },
      {
        campaignId: "sub-2",
        recipientEmail: "b@test.com",
        status: "delivered",
        sentAt: new Date(),
        resendEmailId: "re_2",
      },
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.list(teamCtx, { page: 1, pageSize: 20 })
    const campaign = (output.result as { campaigns: Array<Record<string, unknown>> }).campaigns[0]
    expect(campaign.activeDispatch).toBeNull()
    expect(campaign.dispatchProgressSummary).toMatchObject({
      activeDispatchCount: 1,
      completionKind: "pending",
      acceptedCount: 2,
    })
  })

  it("list summary cumula aceite entre dispatch inicial e retryFailedOnly do mesmo filho", async () => {
    let findManyCalls = 0
    emailCampaignFindManyMock.mockImplementation(async () => {
      findManyCalls += 1
      if (findManyCalls === 1) {
        return [
          {
            id: "parent-retry",
            name: "Pai retry",
            status: "partially_sent",
            scheduledAt: null,
            sentAt: null,
            totalRecipients: 100,
            totalSent: 100,
            totalDelivered: 0,
            totalOpened: 0,
            totalClicked: 0,
            totalBounced: 0,
            dispatchCount: 2,
            createdAt: new Date(),
            createdBy: "profile-1",
            managedByBackofficeUserId: null,
            templateId: "tpl-1",
            contactListId: null,
            radarSegmentSlug: null,
            audienceContactIds: [],
            errorMessage: null,
            _count: { subCampaigns: 1 },
          },
        ]
      }
      return [
        {
          id: "sub-retry",
          status: "sent",
          parentCampaignId: "parent-retry",
          totalRecipients: 100,
        },
      ]
    })
    emailCampaignCountMock.mockImplementation(async () => 1)
    emailCampaignGroupByMock.mockImplementation(async () => [
      {
        parentCampaignId: "parent-retry",
        _sum: {
          totalSent: 100,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalBounced: 0,
          dispatchCount: 2,
        },
      },
    ])
    // Só o dispatch #2 (retry) aparece como latest terminal — o bug antigo reportava 20/20.
    emailCampaignDispatchFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") return []
      return [
        {
          id: "dispatch-retry-2",
          campaignId: "sub-retry",
          dispatchNumber: 2,
          status: "completed",
          totalRecipients: 20,
          retryFailedOnly: true,
          errorMessage: null,
          updatedAt: new Date(),
        },
      ]
    })
    mockLogCounterAggregation(
      Array.from({ length: 20 }, (_, i) => ({
        dispatchId: "dispatch-retry-2",
        status: "sent",
        sentAt: new Date(),
        resendEmailId: `re_retry_${i}`,
      }))
    )
    emailLogFindManyMock.mockImplementation(async () => [
      ...Array.from({ length: 80 }, (_, i) => ({
        campaignId: "sub-retry",
        recipientEmail: `ok${i}@test.com`,
        status: "delivered",
        sentAt: new Date(),
        resendEmailId: `re_ok_${i}`,
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        campaignId: "sub-retry",
        recipientEmail: `fail${i}@test.com`,
        status: "failed",
        sentAt: null as Date | null,
        resendEmailId: null as string | null,
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        campaignId: "sub-retry",
        recipientEmail: `fail${i}@test.com`,
        status: "sent",
        sentAt: new Date(),
        resendEmailId: `re_retry_${i}`,
      })),
    ])

    const uc = new EmailCampaignUseCase()
    const output = await uc.list(teamCtx, { page: 1, pageSize: 20 })
    const campaign = (output.result as { campaigns: Array<Record<string, unknown>> }).campaigns[0]
    expect(campaign.dispatchProgressSummary).toMatchObject({
      acceptedCount: 100,
      totalRecipients: 100,
      completionKind: "full",
      activeDispatchCount: 0,
    })
  })

  it("dispatchScheduledCampaigns cria dispatch com retryFailedOnly false", async () => {
    const scheduledCampaign = {
      id: "camp-scheduled",
      teamId: "team-1",
      status: "scheduled",
      scheduledAt: new Date("2020-01-01T00:00:00.000Z"),
      templateId: "tpl-1",
      contactListId: "list-1",
      radarSegmentSlug: null,
      audienceContactIds: [],
      createdBy: "profile-1",
      template: {
        id: "tpl-1",
        name: "T",
        subject: "S",
        html: "<p>Hi</p>",
        variables: [],
        versionNumber: 1,
      },
      contactList: { id: "list-1", name: "Lista" },
      team: { master: { id: "master-1", timezone: "America/Sao_Paulo" } },
    }
    emailCampaignFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") return []
      if (whereArgs?.where?.status === "scheduled") return [scheduledCampaign]
      return []
    })
    emailCampaignUpdateManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") return { count: 0 }
      if (whereArgs?.where?.status === "scheduled" || whereArgs?.where?.id === "camp-scheduled") {
        return { count: 1 }
      }
      return { count: 0 }
    })
    emailCampaignDispatchUpdateManyMock.mockImplementation(async () => ({ count: 0 }))
    emailCampaignDispatchCreateMock.mockImplementation(async () => ({ id: "dispatch-sched" }))
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(1))
    )
    dispatchBatchMock.mockImplementation(async () => ({
      sent: 1,
      failed: 0,
      dispatched: [{ email: "r0@test.com", resendId: "re_1" }],
      providerErrors: [],
    }))
    emailCampaignDispatchFindFirstMock.mockImplementation(async () => ({ id: "dispatch-sched" }))
    emailCampaignFindUniqueMock.mockImplementation(async () => ({
      name: "Sched",
      parentCampaignId: null,
    }))
    emailCampaignDispatchFindUniqueMock.mockImplementation(async () => ({
      triggeredBy: "profile-1",
      status: "sending",
    }))
    processPendingBatchMock.mockImplementation(async () => ({
      processed: 0,
      failed: 0,
      skipped: 0,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.dispatchScheduledCampaigns({ maxCampaigns: 1 })
    expect(output.isValid).toBe(true)
    expect(emailCampaignDispatchCreateMock).toHaveBeenCalled()
    const createArg = emailCampaignDispatchCreateMock.mock.calls[0] as unknown as [
      { data: { retryFailedOnly?: boolean; teamId?: string } },
    ]
    expect(createArg[0].data.retryFailedOnly).toBe(false)
    expect(createArg[0].data.teamId).toBe("team-1")
  })

  it("dispatchScheduledCampaigns nunca materializa a audiência inteira no kickoff — só conta e publica wake (resiliência, incidente Lista Fria)", async () => {
    const scheduledCampaign = {
      id: "camp-scheduled-big",
      teamId: "team-1",
      status: "scheduled",
      scheduledAt: new Date("2020-01-01T00:00:00.000Z"),
      templateId: "tpl-1",
      contactListId: "list-1",
      radarSegmentSlug: null,
      audienceContactIds: [],
      createdBy: "profile-1",
      template: {
        id: "tpl-1",
        name: "T",
        subject: "S",
        html: "<p>Hi</p>",
        variables: [],
        versionNumber: 1,
      },
      contactList: { id: "list-1", name: "Lista" },
      team: { master: { id: "master-1", timezone: "America/Sao_Paulo" } },
    }
    emailCampaignFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") return []
      if (whereArgs?.where?.status === "scheduled") return [scheduledCampaign]
      return []
    })
    emailCampaignUpdateManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      if (whereArgs?.where?.status === "sending") return { count: 0 }
      if (whereArgs?.where?.status === "scheduled" || whereArgs?.where?.id === "camp-scheduled-big") {
        return { count: 1 }
      }
      return { count: 0 }
    })
    emailCampaignDispatchUpdateManyMock.mockImplementation(async () => ({ count: 0 }))
    emailCampaignDispatchCreateMock.mockImplementation(async () => ({ id: "dispatch-sched-big" }))
    // Audiência "grande" (abaixo do limite diário mockado de 2000, só pra provar
    // que o kickoff não materializa nada, não pra estressar o guard de limite
    // diário): buildCampaignDispatchInputMock (via countActiveRecipients fallback
    // do harness) simula 1.500 destinatários — dispatchScheduledCampaigns não deve
    // mais chamar dispatchInput.recipients em nenhum ponto do kickoff.
    buildCampaignDispatchInputMock.mockImplementation(async () =>
      makeDefaultDispatchInput(makeRecipients(1_500))
    )
    processPendingBatchMock.mockImplementation(async () => ({
      processed: 0,
      failed: 0,
      skipped: 0,
    }))

    const uc = new EmailCampaignUseCase()
    const output = await uc.dispatchScheduledCampaigns({ maxCampaigns: 1 })

    expect(output.isValid).toBe(true)
    expect(emailCampaignDispatchCreateMock).toHaveBeenCalled()
    const createArg = emailCampaignDispatchCreateMock.mock.calls[0] as unknown as [
      { data: { totalRecipients?: number } },
    ]
    expect(createArg[0].data.totalRecipients).toBe(1_500)
    // Núcleo do fix: nenhum EmailLog é criado no kickoff — a materialização em
    // lotes de DISPATCH_QUEUE_BATCH_SIZE fica a cargo do consumer da fila.
    expect(createQueuedLogsMock).not.toHaveBeenCalled()
    expect(publishEmailCampaignDispatchWakeMock).toHaveBeenCalledWith(
      expect.objectContaining({ dispatchId: "dispatch-sched-big", reason: "cron-start" })
    )
  })

  it("query de logs de progresso sempre filtra por teamId", async () => {
    emailCampaignFindManyMock.mockImplementation(async () => [
      {
        id: "camp-1",
        name: "Camp",
        status: "sending",
        scheduledAt: null,
        sentAt: null,
        totalRecipients: 1,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        dispatchCount: 1,
        createdAt: new Date(),
        createdBy: "profile-1",
        managedByBackofficeUserId: null,
        templateId: "tpl-1",
        contactListId: "list-1",
        radarSegmentSlug: null,
        audienceContactIds: ["c1"],
        errorMessage: null,
        _count: { subCampaigns: 0 },
      },
    ])
    emailCampaignCountMock.mockImplementation(async () => 1)
    emailCampaignDispatchFindManyMock.mockImplementation(async (args: unknown) => {
      const whereArgs = args as MockWhereArgs
      expect(whereArgs?.where?.teamId).toBe("team-1")
      return [
        {
          id: "dispatch-1",
          campaignId: "camp-1",
          dispatchNumber: 1,
          status: "sending",
          totalRecipients: 1,
          retryFailedOnly: false,
          errorMessage: null,
          updatedAt: new Date(),
        },
      ]
    })
    queryRawMock.mockImplementation(async (...args: unknown[]) => {
      expect(args[1]).toBe("team-1")
      expect(Array.isArray(args[2])).toBe(true)
      expect((args[2] as string[]).length).toBeGreaterThan(0)
      return []
    })

    const uc = new EmailCampaignUseCase()
    await uc.list(teamCtx, { page: 1, pageSize: 20 })
    expect(queryRawMock).toHaveBeenCalled()
  })
})
