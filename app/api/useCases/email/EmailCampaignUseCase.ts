import { randomUUID } from "crypto"
import { Prisma, type EmailCampaignStatus, type PrismaClient } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma, getEmailCronPrisma } from "@/app/api/infra/data/prisma"
import { EmailCampaignDispatchService } from "@/app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService"
import { EmailCampaignRecipientService } from "@/app/api/services/EmailCampaignDispatch/EmailCampaignRecipientService"
import type {
  CampaignRecipient,
} from "@/app/api/services/EmailCampaignDispatch/IEmailCampaignRecipientService"
import { EmailCreditService } from "@/app/api/services/EmailCredit/EmailCreditService"
import { emailCampaignLeadActivityService } from "@/app/api/services/email/EmailCampaignLeadActivityService"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import { resolveEmailCreator } from "@/lib/email/format-email-creator"
import {
  interpolateEmailTemplate,
  type EmailTemplateVariableDefinition,
} from "@/lib/email/interpolate"
import { inlineEmailHtml } from "@/lib/email/inline-email-html"
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService"
import { teamEmailDispatchLogger } from "@/lib/email/team-email-dispatch-logger"
import {
  CUSTOM_RADAR_SEGMENT_PREFIX,
  isValidRadarSegmentAudience,
  radarSegmentLockKey,
} from "@/lib/radar/segment-audience"
import { listRadarSegmentEmailRecipients } from "@/lib/radar/list-segment-recipients"
import { withConcurrencyLimit } from "@/lib/async/with-concurrency-limit"
import { formatIntimezone, formatLocalDateValue, resolveTimezone } from "@/lib/dates"
import {
  checkDispatchWindow,
  getResendDomainDispatchWarnings,
  resolveCampaignStatusAfterDispatch,
  type DispatchBlockedDateEntry,
} from "@/lib/email/campaign-dispatch-guards"
import {
  countSuccessfulDispatchLogs,
  persistDispatchTerminalFallback,
  withDispatchTerminalCommitRetry,
} from "@/lib/email/dispatch-reconcile-resilience"
import {
  formatInvalidRecipientFailureMessage,
  formatProviderBatchFailureMessage,
  isValidResendRecipientEmail,
} from "@/lib/email/is-valid-resend-recipient-email"
import type { DispatchProviderError } from "@/app/api/services/EmailCampaignDispatch/IEmailCampaignDispatchService"
import { canDispatchEmail } from "@/lib/email/email-rbac"
import { enrichCampaignRecipientsWithRadar } from "@/lib/radar/enrich-campaign-recipients"
import { emailOrphanEventService } from "@/app/api/services/resend/EmailOrphanEventService"
import {
  assertCampaignFromIsSendable,
  formatCampaignFromHeader,
  resolveCampaignFrom,
} from "@/lib/email/resolve-campaign-from"
import { wouldExceedDailyEmailCap } from "@/lib/email/campaign-daily-dispatch-guard"
import {
  formatDailyLimitFailureMessage,
  EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB,
  isDailyLimitErrorMessage,
} from "@/lib/email/campaign-limits"
import { notifyCampaignDispatchFailure } from "@/lib/email/notify-campaign-dispatch-failure"
import { resolveTeamEmailCampaignLimits } from "@/lib/email/resolve-team-email-campaign-limits"
import {
  requiresSubCampaignSplit,
} from "@/lib/email/campaign-sub-campaigns"
import {
  buildCampaignPlan,
  buildCampaignPlanFromContactIds,
  mergeListAndSegmentContacts,
  normalizeContactListIds,
  resolveListStrategy,
  validateCampaignPlanSchedules,
  type CombinedAudienceContact,
  type ListAudienceSlice,
  type ListStrategy,
  type SubCampaignScheduleInput,
} from "@/lib/email/campaign-plan"
import { emailContactListRepository } from "@/app/api/infra/data/repositories/emailContactList/EmailContactListRepository"
import { teamRadarSegmentService } from "@/app/api/services/radar/TeamRadarSegmentService"
import { parseRadarSegmentRules } from "@/lib/radar/segment-dsl"
import { detectLinkedFormFromTemplateHtml } from "@/lib/email/detect-template-form"
import {
  CAMPAIGN_PROVIDER_SUCCESS_LOG_STATUSES,
  CAMPAIGN_RETRY_EXCLUDE_LOG_STATUSES,
  CAMPAIGN_RETRY_FAILURE_LOG_STATUS,
  resolveRetryRecipientEmails,
  selectFailedRecipientEmailsForRetry,
} from "@/lib/email/campaign-failed-recipients"
import {
  aggregateCumulativeDispatchLogCounters,
  buildCampaignDispatchProgress,
  buildCampaignDispatchProgressSummary,
  buildCumulativeCampaignDispatchProgress,
  isDispatchLogAccepted,
  type CampaignDispatchProgress,
  type CampaignDispatchProgressStatus,
  type DispatchLogCounters,
} from "@/lib/email/campaign-dispatch-progress"

const EMAIL_LOG_WRITE_CONCURRENCY_LIMIT = 2
const STUCK_SENDING_THRESHOLD_MS = 30 * 60 * 1000
const ORPHAN_RESUME_MIN_AGE_MS = 2 * 60 * 1000
const DEFAULT_SCHEDULED_BATCH_SIZE = 5
const DEFAULT_ORPHAN_RESUME_BATCH_SIZE = 3
const MANUAL_DISPATCH_STATUSES = ["draft", "scheduled", "sent", "failed", "partially_sent"] as const
const MANUAL_DISPATCH_STATUS_SET = new Set<EmailCampaignStatus>(MANUAL_DISPATCH_STATUSES)
const RETRY_FAILED_ONLY_STATUSES = new Set<EmailCampaignStatus>(["failed", "partially_sent"])
const TERMINAL_DISPATCH_FEEDBACK_STATUSES = new Set<EmailCampaignStatus>([
  "sent",
  "partially_sent",
  "failed",
])
const DISPATCH_PROGRESS_SELECT = {
  id: true,
  campaignId: true,
  dispatchNumber: true,
  status: true,
  totalRecipients: true,
  retryFailedOnly: true,
  errorMessage: true,
  updatedAt: true,
} as const

type DispatchProgressRow = {
  id: string
  campaignId: string
  dispatchNumber: number
  status: CampaignDispatchProgressStatus
  totalRecipients: number
  retryFailedOnly: boolean
  errorMessage: string | null
  updatedAt: Date
}

export type ManualDispatchOptions = {
  /** Quando true (ou status failed/partially_sent), envia só destinatários com falha elegíveis. */
  retryFailedOnly?: boolean
}

export const EMAIL_CAMPAIGN_FAILURE_MESSAGES = {
  NO_FAILED_RECIPIENTS:
    "Não há destinatários com falha para reenviar. Quem já recebeu não será reenviado.",
  NO_HTML: "Template sem HTML. Edite o template antes de disparar",
  NO_CREDITS: "Sem assinatura de créditos de e-mail ativa. Ative um plano em Assinaturas",
  NO_RADAR_BETA:
    "Envio de e-mail liberado apenas para o Grupo Beta de Radar no time ativo",
  NO_RECIPIENTS_LIST: "Nenhum contato ativo na lista para envio",
  NO_RECIPIENTS_RADAR: "Nenhum perfil apto no segmento Radar",
  STUCK_SENDING: "Disparo interrompido: tempo limite de envio excedido (30 min)",
  INTERNAL: "Erro interno durante o disparo",
  RESEND_ZERO: "Nenhum e-mail foi enviado pelo provedor",
  formatDailyLimit: formatDailyLimitFailureMessage,
} as const

export interface CreateCampaignInput {
  name: string
  description?: string | null
  templateId: string
  contactListId?: string
  contactListIds?: string[]
  listStrategy?: ListStrategy
  radarSegmentSlug?: string
  /** Na revisão: clonar regras do segmento custom selecionado em um novo TeamRadarSegment. */
  saveAsRadarSegment?: boolean
  saveAsRadarSegmentName?: string | null
  scheduledAt?: string | null
  scheduleIntervalDays?: number | null
  uniformSchedule?: boolean
  subCampaignSchedules?: SubCampaignScheduleInput[]
  subCampaignTemplates?: Array<{ index: number; templateId: string }>
}

export type SubCampaignUpdateInput = {
  id: string
  name?: string
  scheduledAt?: string | null
  contactListId?: string
  templateId?: string
}

export type UpdateCampaignInput = Partial<CreateCampaignInput> & {
  subCampaignUpdates?: SubCampaignUpdateInput[]
}

export type ManualDispatchJob = {
  campaignId: string
  dispatchId: string
  dispatchNumber: number
  teamId: string
  previousStatus: EmailCampaignStatus
  reservedCredits: number
  hasCampaignsBetaAccess: boolean
  recipients: CampaignRecipient[]
  subject: string
  html: string
  from: string
  replyTo: string | null
  globalDefaults: Record<string, string>
  templateVariables: EmailTemplateVariableDefinition[]
  logIdsByEmail: Array<{ email: string; logId: string }>
  totalRecipients: number
  retryFailedOnly: boolean
  status: "sending"
  batchIdempotencyScheme: "positional" | "contentHash"
  enableContentHashFallbackOnIdempotencyConflict?: boolean
  warnings?: string[]
}

export class EmailCampaignUseCase {
  private dispatchService = new EmailCampaignDispatchService()
  private recipientService = new EmailCampaignRecipientService()
  private creditService = new EmailCreditService()

  constructor(private readonly db: PrismaClient = prisma) {}

  static forDispatchCron(): EmailCampaignUseCase {
    return new EmailCampaignUseCase(getEmailCronPrisma())
  }

  private async notifyDispatchFailureIfNeeded(params: {
    recipientProfileId: string | null | undefined
    teamId: string
    campaignId: string
    campaignName: string
    dispatchId?: string
    errorMessage: string | null | undefined
  }): Promise<void> {
    if (!params.recipientProfileId || !params.errorMessage) return

    await notifyCampaignDispatchFailure({
      recipientProfileId: params.recipientProfileId,
      teamId: params.teamId,
      campaignId: params.campaignId,
      campaignName: params.campaignName,
      dispatchId: params.dispatchId,
      errorMessage: params.errorMessage,
    }).catch((error) => {
      console.error("[EmailCampaignUseCase][notifyDispatchFailureIfNeeded]", error)
    })
  }

  private resolveDispatchFailureMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && isDailyLimitErrorMessage(error.message)) {
      return error.message
    }
    if (typeof error === "string" && isDailyLimitErrorMessage(error)) {
      return error
    }
    return fallback
  }

  private async aggregateLogCountersByDispatchId(
    teamId: string,
    dispatchIds: string[]
  ): Promise<Map<string, DispatchLogCounters>> {
    const countersByDispatchId = new Map<string, DispatchLogCounters>()
    if (dispatchIds.length === 0) return countersByDispatchId

    for (const dispatchId of dispatchIds) {
      countersByDispatchId.set(dispatchId, {
        acceptedCount: 0,
        failedCount: 0,
        queuedCount: 0,
      })
    }

    // Agrega no Postgres (não carrega N logs na app). Contrato = accepted por
    // sentAt|resendEmailId; queued/failed só sem aceite.
    const rows = await this.db.$queryRaw<
      Array<{
        dispatchId: string
        acceptedCount: number | bigint
        failedCount: number | bigint
        queuedCount: number | bigint
      }>
    >`
      SELECT
        "dispatchId",
        COUNT(*) FILTER (
          WHERE "sentAt" IS NOT NULL OR "resendEmailId" IS NOT NULL
        )::int AS "acceptedCount",
        COUNT(*) FILTER (
          WHERE status = 'failed'::"email_log_status"
            AND "sentAt" IS NULL
            AND "resendEmailId" IS NULL
        )::int AS "failedCount",
        COUNT(*) FILTER (
          WHERE status = 'queued'::"email_log_status"
            AND "sentAt" IS NULL
            AND "resendEmailId" IS NULL
        )::int AS "queuedCount"
      FROM "corretor_studio_email_logs"
      WHERE "teamId" = ${teamId}::uuid
        AND "dispatchId" = ANY(${dispatchIds}::uuid[])
      GROUP BY "dispatchId"
    `

    for (const row of rows) {
      if (!row.dispatchId) continue
      countersByDispatchId.set(row.dispatchId, {
        acceptedCount: Number(row.acceptedCount),
        failedCount: Number(row.failedCount),
        queuedCount: Number(row.queuedCount),
      })
    }

    return countersByDispatchId
  }

  private async buildProgressForDispatches(
    teamId: string,
    dispatches: DispatchProgressRow[]
  ): Promise<Map<string, CampaignDispatchProgress>> {
    const progressByDispatchId = new Map<string, CampaignDispatchProgress>()
    if (dispatches.length === 0) return progressByDispatchId

    const countersByDispatchId = await this.aggregateLogCountersByDispatchId(
      teamId,
      dispatches.map((dispatch) => dispatch.id)
    )

    for (const dispatch of dispatches) {
      progressByDispatchId.set(
        dispatch.id,
        buildCampaignDispatchProgress(dispatch, countersByDispatchId.get(dispatch.id) ?? {
          acceptedCount: 0,
          failedCount: 0,
          queuedCount: 0,
        })
      )
    }

    return progressByDispatchId
  }

  /**
   * Carrega progresso de dispatch ativo/último para um lote de campanhas (folha).
   * Sempre filtra por teamId. Agrega logs por dispatchId.
   */
  private async loadDispatchProgressForCampaignIds(
    teamId: string,
    campaignMeta: Array<{ id: string; status: EmailCampaignStatus }>
  ): Promise<
    Map<
      string,
      {
        activeDispatch: CampaignDispatchProgress | null
        latestDispatch: CampaignDispatchProgress | null
      }
    >
  > {
    const result = new Map<
      string,
      {
        activeDispatch: CampaignDispatchProgress | null
        latestDispatch: CampaignDispatchProgress | null
      }
    >()

    for (const campaign of campaignMeta) {
      result.set(campaign.id, { activeDispatch: null, latestDispatch: null })
    }

    if (campaignMeta.length === 0) return result

    const campaignIds = campaignMeta.map((campaign) => campaign.id)

    const activeDispatches = (await this.db.emailCampaignDispatch.findMany({
      where: {
        teamId,
        campaignId: { in: campaignIds },
        status: "sending",
      },
      select: DISPATCH_PROGRESS_SELECT,
      orderBy: { dispatchNumber: "desc" },
    })) as DispatchProgressRow[]

    const activeByCampaignId = new Map<string, DispatchProgressRow>()
    for (const dispatch of activeDispatches) {
      if (!activeByCampaignId.has(dispatch.campaignId)) {
        activeByCampaignId.set(dispatch.campaignId, dispatch)
      }
    }

    const terminalCampaignIds = campaignMeta
      .filter(
        (campaign) =>
          !activeByCampaignId.has(campaign.id) &&
          TERMINAL_DISPATCH_FEEDBACK_STATUSES.has(campaign.status)
      )
      .map((campaign) => campaign.id)

    const terminalDispatches: DispatchProgressRow[] = []
    if (terminalCampaignIds.length > 0) {
      const latestCandidates = (await this.db.emailCampaignDispatch.findMany({
        where: {
          teamId,
          campaignId: { in: terminalCampaignIds },
          status: { in: ["completed", "failed"] },
        },
        select: DISPATCH_PROGRESS_SELECT,
        orderBy: [{ campaignId: "asc" }, { dispatchNumber: "desc" }],
      })) as DispatchProgressRow[]

      const seenCampaignIds = new Set<string>()
      for (const dispatch of latestCandidates) {
        if (seenCampaignIds.has(dispatch.campaignId)) continue
        seenCampaignIds.add(dispatch.campaignId)
        terminalDispatches.push(dispatch)
      }
    }

    const allDispatches = [
      ...Array.from(activeByCampaignId.values()),
      ...terminalDispatches,
    ]
    const progressByDispatchId = await this.buildProgressForDispatches(teamId, allDispatches)

    for (const [campaignId, dispatch] of activeByCampaignId) {
      const entry = result.get(campaignId) ?? { activeDispatch: null, latestDispatch: null }
      entry.activeDispatch = progressByDispatchId.get(dispatch.id) ?? null
      result.set(campaignId, entry)
    }

    for (const dispatch of terminalDispatches) {
      const entry = result.get(dispatch.campaignId) ?? {
        activeDispatch: null,
        latestDispatch: null,
      }
      entry.latestDispatch = progressByDispatchId.get(dispatch.id) ?? null
      result.set(dispatch.campaignId, entry)
    }

    return result
  }

  /**
   * Contadores cumulativos por campanha-folha (todos os dispatches), dedupe por
   * recipientEmail. Usa @@index([teamId, campaignId]) em EmailLog.
   */
  private async aggregateCumulativeLogCountersByCampaignId(
    teamId: string,
    campaignIds: string[]
  ): Promise<Map<string, DispatchLogCounters>> {
    const result = new Map<string, DispatchLogCounters>()
    for (const campaignId of campaignIds) {
      result.set(campaignId, { acceptedCount: 0, failedCount: 0, queuedCount: 0 })
    }
    if (campaignIds.length === 0) return result

    const logs = await this.db.emailLog.findMany({
      where: {
        teamId,
        campaignId: { in: campaignIds },
      },
      select: {
        campaignId: true,
        recipientEmail: true,
        status: true,
        sentAt: true,
        resendEmailId: true,
      },
    })

    const logsByCampaignId = new Map<
      string,
      Array<{
        recipientEmail: string
        status: string
        sentAt: Date | null
        resendEmailId: string | null
      }>
    >()

    for (const log of logs) {
      if (!log.campaignId) continue
      const bucket = logsByCampaignId.get(log.campaignId) ?? []
      bucket.push({
        recipientEmail: log.recipientEmail,
        status: log.status,
        sentAt: log.sentAt,
        resendEmailId: log.resendEmailId,
      })
      logsByCampaignId.set(log.campaignId, bucket)
    }

    for (const [campaignId, campaignLogs] of logsByCampaignId) {
      result.set(campaignId, aggregateCumulativeDispatchLogCounters(campaignLogs))
    }

    return result
  }

  /**
   * Self-healing: campanhas-folha com status terminal (`sent`/`failed`/`partially_sent`)
   * podem divergir da realidade quando um erro pós-disparo grava um status incorreto
   * (ex.: falha ao processar a resposta do provedor após o envio real já ter sido aceito).
   * Recalcula o status real a partir dos `EmailLog` cumulativos e corrige o registro
   * quando diverge, retornando os valores corrigidos para uso imediato na resposta.
   */
  private async reconcileLeafCampaignStatuses(
    ctx: TeamContext,
    campaigns: Array<{ id: string; status: EmailCampaignStatus; totalRecipients: number; dispatchCount: number }>
  ): Promise<Map<string, { status: EmailCampaignStatus; totalSent: number }>> {
    const overrides = new Map<string, { status: EmailCampaignStatus; totalSent: number }>()

    const candidates = campaigns.filter(
      (campaign) =>
        TERMINAL_DISPATCH_FEEDBACK_STATUSES.has(campaign.status) &&
        campaign.dispatchCount > 0 &&
        campaign.totalRecipients > 0
    )
    if (candidates.length === 0) return overrides

    // Busca os logs crus (não só os contadores) para conseguir: (a) distinguir
    // "sem log nenhum" de "0 aceites confirmados" e (b) preservar o horário real
    // do último envio aceito em vez de usar o momento da leitura.
    const logs = await this.db.emailLog.findMany({
      where: { teamId: ctx.teamId, campaignId: { in: candidates.map((campaign) => campaign.id) } },
      select: {
        campaignId: true,
        recipientEmail: true,
        status: true,
        sentAt: true,
        resendEmailId: true,
      },
    })

    const logsByCampaignId = new Map<string, typeof logs>()
    for (const log of logs) {
      if (!log.campaignId) continue
      const bucket = logsByCampaignId.get(log.campaignId) ?? []
      bucket.push(log)
      logsByCampaignId.set(log.campaignId, bucket)
    }

    for (const campaign of candidates) {
      const campaignLogs = logsByCampaignId.get(campaign.id)
      // Sem nenhuma evidência de log (ex.: dispatch de backfill criado a partir do
      // status antigo, sem EmailLog associado), não há base para reconciliar —
      // preserva o status persistido em vez de presumir falha.
      if (!campaignLogs || campaignLogs.length === 0) continue

      const { acceptedCount } = aggregateCumulativeDispatchLogCounters(campaignLogs)
      const correctStatus: EmailCampaignStatus =
        acceptedCount >= campaign.totalRecipients
          ? "sent"
          : acceptedCount === 0
            ? "failed"
            : "partially_sent"

      if (correctStatus === campaign.status) continue

      const lastAcceptedAt = campaignLogs
        .filter((log) => isDispatchLogAccepted(log))
        .map((log) => (log.sentAt ? new Date(log.sentAt) : null))
        .filter((value): value is Date => value !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0]

      try {
        await this.db.emailCampaign.update({
          where: { id: campaign.id },
          data: {
            status: correctStatus,
            totalSent: acceptedCount,
            ...(correctStatus === "sent"
              ? { errorMessage: null, ...(lastAcceptedAt ? { sentAt: lastAcceptedAt } : {}) }
              : {}),
          },
        })
        overrides.set(campaign.id, { status: correctStatus, totalSent: acceptedCount })
      } catch (error) {
        console.error("[EmailCampaignUseCase][reconcileLeafCampaignStatuses]", {
          campaignId: campaign.id,
          error,
        })
      }
    }

    return overrides
  }

  private async resolvePublishedTemplate(templateId: string, teamId: string) {
    const ref = await this.db.emailTemplate.findFirst({
      where: { id: templateId, teamId, isArchived: false },
      select: { versionGroupId: true },
    })
    if (!ref) return null

    return this.db.emailTemplate.findFirst({
      where: {
        teamId,
        versionGroupId: ref.versionGroupId,
        status: "published",
        isCurrentPublished: true,
        approvalStatus: "approved",
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        subject: true,
        html: true,
        variables: true,
        versionNumber: true,
      },
    })
  }

  private async findCurrentPublishedTemplate(templateId: string, teamId: string) {
    const template = await this.resolvePublishedTemplate(templateId, teamId)
    return template ? { id: template.id } : null
  }

  private async countActiveRecipients(
    teamId: string,
    options: { contactListId?: string | null; radarSegmentSlug?: string | null }
  ): Promise<number> {
    if (options.radarSegmentSlug) {
      const recipients = await listRadarSegmentEmailRecipients(teamId, options.radarSegmentSlug)
      return recipients.length
    }
    if (!options.contactListId) return 0
    const recipients = await this.recipientService.listActiveRecipients(teamId, options.contactListId)
    return recipients.length
  }

  private async loadListAudiences(
    teamId: string,
    contactListIds: string[]
  ): Promise<{ slices: ListAudienceSlice[]; error?: string }> {
    if (contactListIds.length === 0) {
      return { slices: [], error: "Selecione ao menos uma lista de contatos" }
    }

    const lists = await this.db.emailContactList.findMany({
      where: { id: { in: contactListIds }, teamId, isArchived: false },
      select: { id: true, name: true },
    })

    if (lists.length !== contactListIds.length) {
      return { slices: [], error: "Uma ou mais listas não foram encontradas ou não pertencem ao time" }
    }

    const listsById = new Map(lists.map((list) => [list.id, list]))
    const slices: ListAudienceSlice[] = []

    for (const listId of contactListIds) {
      const list = listsById.get(listId)
      if (!list) continue
      const recipients = await this.recipientService.listActiveRecipients(teamId, listId)
      slices.push({
        listId: list.id,
        listName: list.name,
        contacts: recipients
          .filter((recipient) => recipient.contactId)
          .map((recipient) => ({
            contactId: recipient.contactId as string,
            email: recipient.email,
          })),
      })
    }

    return { slices }
  }

  /**
   * União lista(s) + segmento: dedupe por e-mail.
   * Contatos só-de-segmento ficam sem contactId até materialização no create.
   */
  private async resolveCombinedAudience(
    teamId: string,
    contactListIds: string[],
    radarSegmentSlug: string | undefined
  ): Promise<{ contacts: CombinedAudienceContact[]; error?: string }> {
    let listContacts: Array<{ contactId: string; email: string }> = []

    if (contactListIds.length > 0) {
      const { slices, error } = await this.loadListAudiences(teamId, contactListIds)
      if (error) return { contacts: [], error }
      listContacts = slices.flatMap((slice) => slice.contacts)
    }

    const segmentRecipients = radarSegmentSlug
      ? await listRadarSegmentEmailRecipients(teamId, radarSegmentSlug)
      : []

    return {
      contacts: mergeListAndSegmentContacts({
        listContacts,
        segmentRecipients,
      }),
    }
  }

  /**
   * Garante EmailContact IDs para e-mails só-de-segmento (snapshot em lista dedicada).
   * Necessário para freeze em audienceContactIds e split de sub-campanhas (DA11).
   */
  private async materializeMissingContactIds(params: {
    teamId: string
    profileId: string
    campaignName: string
    contacts: CombinedAudienceContact[]
  }): Promise<{ contactIds: string[]; snapshotListId: string | null; error?: string }> {
    const withIds = params.contacts.filter(
      (contact): contact is CombinedAudienceContact & { contactId: string } =>
        Boolean(contact.contactId)
    )
    const withoutIds = params.contacts.filter((contact) => !contact.contactId)

    if (withoutIds.length === 0) {
      return {
        contactIds: withIds.map((contact) => contact.contactId),
        snapshotListId: null,
      }
    }

    const timestamp = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    const listName = `Campanha: ${params.campaignName.trim()} — segmento (${timestamp})`

    const list = await emailContactListRepository.createList({
      teamId: params.teamId,
      createdBy: params.profileId,
      name: listName,
    })

    const BATCH_SIZE = 500
    for (let i = 0; i < withoutIds.length; i += BATCH_SIZE) {
      const batch = withoutIds.slice(i, i + BATCH_SIZE)
      await emailContactListRepository.createContacts(
        list.id,
        batch.map((contact) => ({ email: contact.email, name: contact.name ?? null }))
      )
    }

    const created = await this.db.emailContact.findMany({
      where: { listId: list.id },
      select: { id: true },
    })

    await emailContactListRepository.updateContactCount(list.id, created.length)

    return {
      contactIds: [...withIds.map((contact) => contact.contactId), ...created.map((row) => row.id)],
      snapshotListId: list.id,
    }
  }

  /**
   * Clona regras de um segmento custom em novo TeamRadarSegment (revisão do wizard).
   * Segmentos de sistema não têm DSL — não inventa regras.
   */
  private async maybeSaveAsRadarSegment(
    teamId: string,
    profileId: string,
    data: CreateCampaignInput
  ): Promise<{ radarSegmentSlug: string | undefined; error?: string }> {
    const currentSlug = data.radarSegmentSlug?.trim() || undefined
    if (!data.saveAsRadarSegment) {
      return { radarSegmentSlug: currentSlug }
    }

    if (!currentSlug?.startsWith(CUSTOM_RADAR_SEGMENT_PREFIX)) {
      return {
        radarSegmentSlug: currentSlug,
        error:
          "Salvar como segmento Radar só é possível a partir de um segmento custom com regras DSL (não a partir de listas ou segmentos do sistema)",
      }
    }

    const segmentId = currentSlug.slice(CUSTOM_RADAR_SEGMENT_PREFIX.length)
    const existing = await teamRadarSegmentService.findById(teamId, segmentId)
    if (!existing?.isActive) {
      return { radarSegmentSlug: currentSlug, error: "Segmento Radar inválido" }
    }

    const name =
      data.saveAsRadarSegmentName?.trim() ||
      `${data.name.trim()} — segmento` ||
      existing.name

    try {
      const rules = parseRadarSegmentRules(existing.rulesJson)
      const created = await teamRadarSegmentService.create(teamId, profileId, {
        name,
        description: existing.description,
        rules,
      })
      return { radarSegmentSlug: `${CUSTOM_RADAR_SEGMENT_PREFIX}${created.id}` }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar segmento Radar"
      return { radarSegmentSlug: currentSlug, error: message }
    }
  }

  private parseScheduleInput(data: CreateCampaignInput) {
    return {
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      scheduleIntervalDays: data.scheduleIntervalDays ?? null,
      uniformSchedule: data.uniformSchedule !== false,
      subCampaignSchedules: data.subCampaignSchedules,
    }
  }

  async previewPlan(data: CreateCampaignInput, ctx: TeamContext): Promise<Output> {
    try {
      if (!data.name?.trim()) {
        return new Output(false, [], ["Nome da campanha é obrigatório"], null)
      }

      const contactListIds = normalizeContactListIds(data)
      const hasLists = contactListIds.length > 0
      const hasRadar = Boolean(data.radarSegmentSlug)

      if (!hasLists && !hasRadar) {
        return new Output(false, [], ["Selecione uma lista de contatos ou um segmento Radar"], null)
      }

      if (hasRadar && data.radarSegmentSlug && !(await isValidRadarSegmentAudience(ctx.teamId, data.radarSegmentSlug))) {
        return new Output(false, [], ["Segmento Radar inválido"], null)
      }

      if (hasRadar && hasLists && data.listStrategy === "per_list") {
        return new Output(
          false,
          [],
          ["Estratégia por lista não é compatível com segmento Radar. Use juntar listas (merge)"],
          null
        )
      }

      const schedule = this.parseScheduleInput(data)
      const teamLimits = await resolveTeamEmailCampaignLimits(ctx.teamId)
      const maxPerSub = teamLimits.maxRecipientsPerSub

      // Somente segmento: rejeita acima do limite (DA11 — sem split)
      if (hasRadar && !hasLists) {
        const totalRecipients = await this.countActiveRecipients(ctx.teamId, {
          radarSegmentSlug: data.radarSegmentSlug,
        })
        if (requiresSubCampaignSplit(totalRecipients, maxPerSub)) {
          const limitLabel =
            maxPerSub?.toLocaleString("pt-BR") ??
            EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")
          return new Output(
            false,
            [],
            [
              `Audiência excede o limite de ${limitLabel} destinatários por campanha de segmento. Refine as condições ou materialize em lista de contatos (listas podem usar sub-campanhas)`,
            ],
            null
          )
        }
        return new Output(true, [], [], {
          subCampaigns: [
            {
              index: 1,
              name: data.name.trim(),
              totalRecipients,
              scheduledAt: schedule.scheduledAt?.toISOString() ?? null,
            },
          ],
          needsSplit: false,
          totalRecipients,
          listStrategy: "single",
          sourceContactListIds: [],
          isParentCampaign: false,
          audienceMode: "segment_only",
        })
      }

      // Lista(s) ou segmento+lista: união com dedupe; split permitido (audiência materializável)
      if (hasRadar && hasLists) {
        const { contacts, error } = await this.resolveCombinedAudience(
          ctx.teamId,
          contactListIds,
          data.radarSegmentSlug
        )
        if (error) return new Output(false, [], [error], null)

        // Preview: IDs reais das listas + placeholders estáveis para e-mails só-de-segmento
        const previewIds = contacts.map((contact, index) =>
          contact.contactId ?? `preview-segment-${index}`
        )
        const plan = buildCampaignPlanFromContactIds({
          campaignName: data.name,
          contactIds: previewIds,
          sourceContactListIds: contactListIds,
          maxRecipientsPerSub: maxPerSub,
          ...schedule,
        })

        // Preview é descoberta: devolve o plano dividido sem exigir horários
        // (o wizard só preenche os agendamentos depois de ver o split). A
        // validação de completude do agendamento fica no create/update.
        return new Output(true, [], [], {
          ...plan,
          audienceMode: "combined",
          // Não vaza placeholders no payload — create materializa de verdade
          subCampaigns: plan.subCampaigns.map((sub) => ({
            ...sub,
            audienceContactIds: undefined,
          })),
        })
      }

      const listStrategy = resolveListStrategy(data)
      if (contactListIds.length > 1 && data.listStrategy !== "merge" && data.listStrategy !== "per_list") {
        return new Output(false, [], ["Selecione a estratégia de uso das listas (merge ou per_list)"], null)
      }

      const { slices, error } = await this.loadListAudiences(ctx.teamId, contactListIds)
      if (error) return new Output(false, [], [error], null)

      const plan = buildCampaignPlan({
        campaignName: data.name,
        listStrategy,
        sourceContactListIds: listStrategy === "merge" ? contactListIds : contactListIds,
        listAudiences: slices,
        maxRecipientsPerSub: maxPerSub,
        ...schedule,
      })

      // Preview é descoberta: devolve o plano dividido sem exigir horários
      // (o wizard só preenche os agendamentos depois de ver o split). A
      // validação de completude do agendamento fica no create/update.
      return new Output(true, [], [], { ...plan, audienceMode: "list_only" })
    } catch (error) {
      console.error("[EmailCampaignUseCase][previewPlan]", error)
      return new Output(false, [], ["Erro ao calcular plano da campanha"], null)
    }
  }

  async list(ctx: TeamContext, options: { status?: string | string[]; page: number; pageSize: number; name?: string; createdAtFrom?: string; createdAtTo?: string }): Promise<Output> {
    try {
      const statuses = Array.isArray(options.status)
        ? options.status
        : options.status
          ? [options.status]
          : []
      const where = {
        teamId: ctx.teamId,
        parentCampaignId: null,
        ...(statuses.length === 1 && { status: statuses[0] as EmailCampaignStatus }),
        ...(statuses.length > 1 && { status: { in: statuses as EmailCampaignStatus[] } }),
        ...(options.name && { name: { contains: options.name, mode: "insensitive" as const } }),
        ...((options.createdAtFrom || options.createdAtTo) && {
          createdAt: {
            ...(options.createdAtFrom && { gte: new Date(options.createdAtFrom) }),
            ...(options.createdAtTo && { lte: new Date(`${options.createdAtTo}T23:59:59.999Z`) }),
          },
        }),
      }

      const [campaigns, total] = await this.db.$transaction([
        this.db.emailCampaign.findMany({
          where,
          select: {
            id: true,
            name: true,
            status: true,
            scheduledAt: true,
            sentAt: true,
            totalRecipients: true,
            totalSent: true,
            totalDelivered: true,
            totalOpened: true,
            totalClicked: true,
            totalBounced: true,
            dispatchCount: true,
            createdAt: true,
            createdBy: true,
            managedByBackofficeUserId: true,
            templateId: true,
            contactListId: true,
            radarSegmentSlug: true,
            audienceContactIds: true,
            errorMessage: true,
            _count: { select: { subCampaigns: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (options.page - 1) * options.pageSize,
          take: options.pageSize,
        }),
        this.db.emailCampaign.count({ where }),
      ])

      const creatorIds = Array.from(new Set(campaigns.map((campaign) => campaign.createdBy)))
      const templateIds = Array.from(new Set(campaigns.map((campaign) => campaign.templateId)))
      const contactListIds = Array.from(
        new Set(campaigns.map((campaign) => campaign.contactListId).filter((id): id is string => Boolean(id)))
      )

      const [creators, templates, contactLists] = await this.db.$transaction([
        this.db.profile.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, fullName: true, email: true },
        }),
        this.db.emailTemplate.findMany({
          where: { id: { in: templateIds }, teamId: ctx.teamId },
          select: { id: true, name: true },
        }),
        this.db.emailContactList.findMany({
          where: { id: { in: contactListIds }, teamId: ctx.teamId },
          select: { id: true, name: true },
        }),
      ])

      const parentIdsWithSubs = campaigns
        .filter((campaign) => campaign._count.subCampaigns > 0)
        .map((campaign) => campaign.id)

      const childCampaignsForProgress =
        parentIdsWithSubs.length > 0
          ? await this.db.emailCampaign.findMany({
              where: { parentCampaignId: { in: parentIdsWithSubs }, teamId: ctx.teamId },
              select: {
                id: true,
                status: true,
                parentCampaignId: true,
                totalRecipients: true,
                dispatchCount: true,
              },
            })
          : []

      // Self-healing: corrige status terminal (folhas + sub-campanhas) que divergiu dos
      // EmailLog reais antes de agregar o status da campanha-pai, para que a agregação
      // abaixo já parta de dados corretos.
      const leafReconcileOverrides = await this.reconcileLeafCampaignStatuses(ctx, [
        ...campaigns
          .filter((campaign) => campaign._count.subCampaigns === 0)
          .map((campaign) => ({
            id: campaign.id,
            status: campaign.status,
            totalRecipients: campaign.totalRecipients,
            dispatchCount: campaign.dispatchCount,
          })),
        ...childCampaignsForProgress.map((child) => ({
          id: child.id,
          status: child.status,
          totalRecipients: child.totalRecipients,
          dispatchCount: child.dispatchCount,
        })),
      ])
      for (const child of childCampaignsForProgress) {
        const override = leafReconcileOverrides.get(child.id)
        if (override) child.status = override.status
      }

      const parentStatusOverrides = new Map<string, EmailCampaignStatus>()
      await Promise.all(
        parentIdsWithSubs.map(async (parentId) => {
          const refreshed = await this.refreshParentCampaignStatus(parentId).catch((error) => {
            console.error("[EmailCampaignUseCase][list][refreshParent]", { parentId, error })
            return null
          })
          if (refreshed) parentStatusOverrides.set(parentId, refreshed.status)
        })
      )

      const childAggregates =
        parentIdsWithSubs.length > 0
          ? await this.db.emailCampaign.groupBy({
              by: ["parentCampaignId"],
              where: { parentCampaignId: { in: parentIdsWithSubs }, teamId: ctx.teamId },
              _sum: {
                totalSent: true,
                totalDelivered: true,
                totalOpened: true,
                totalClicked: true,
                totalBounced: true,
                dispatchCount: true,
              },
            })
          : []

      const leafCampaignMeta = [
        ...campaigns
          .filter((campaign) => campaign._count.subCampaigns === 0)
          .map((campaign) => ({ id: campaign.id, status: campaign.status })),
        ...childCampaignsForProgress.map((child) => ({
          id: child.id,
          status: child.status,
        })),
      ]

      const progressByCampaignId = await this.loadDispatchProgressForCampaignIds(
        ctx.teamId,
        leafCampaignMeta
      )

      const childIdsForCumulative = childCampaignsForProgress.map((child) => child.id)
      const cumulativeByCampaignId = await this.aggregateCumulativeLogCountersByCampaignId(
        ctx.teamId,
        childIdsForCumulative
      )

      const childrenByParentId = new Map<string, typeof childCampaignsForProgress>()
      for (const child of childCampaignsForProgress) {
        if (!child.parentCampaignId) continue
        const bucket = childrenByParentId.get(child.parentCampaignId) ?? []
        bucket.push(child)
        childrenByParentId.set(child.parentCampaignId, bucket)
      }

      const aggregatesByParent = new Map(
        childAggregates.map((row) => [row.parentCampaignId as string, row._sum])
      )

      // Campanhas com audienceContactIds congelado (ex.: segmento+lista) mantêm totalRecipients
      // persistido — countActiveRecipients prioriza só o segmento Radar e ignora a união.
      const dynamicRecipientCounts = new Map(
        await Promise.all(
          campaigns
            .filter(
              (campaign) =>
                campaign._count.subCampaigns === 0 &&
                campaign.audienceContactIds.length === 0 &&
                ["draft", "scheduled", "sending"].includes(campaign.status)
            )
            .map(async (campaign) => {
              const count = await this.countActiveRecipients(ctx.teamId, {
                contactListId: campaign.contactListId,
                radarSegmentSlug: campaign.radarSegmentSlug,
              })
              return [campaign.id, count] as const
            })
        )
      )

      const creatorsById = new Map(creators.map((creator) => [creator.id, creator]))
      const templatesById = new Map(templates.map((template) => [template.id, template]))
      const contactListsById = new Map(contactLists.map((contactList) => [contactList.id, contactList]))

      return new Output(true, [], [], {
        campaigns: campaigns.map((campaign) => {
          const childSum = aggregatesByParent.get(campaign.id)
          const subCampaignCount = campaign._count.subCampaigns
          const leafOverride = subCampaignCount === 0 ? leafReconcileOverrides.get(campaign.id) : undefined
          const effectiveStatus =
            parentStatusOverrides.get(campaign.id) ?? leafOverride?.status ?? campaign.status
          const totalRecipients = dynamicRecipientCounts.get(campaign.id) ?? campaign.totalRecipients
          const totalSent = childSum?.totalSent ?? leafOverride?.totalSent ?? campaign.totalSent
          const isLeafRetryStatus =
            subCampaignCount === 0 && RETRY_FAILED_ONLY_STATUSES.has(effectiveStatus)

          const leafProgress = progressByCampaignId.get(campaign.id)
          const childProgresses =
            subCampaignCount > 0
              ? (childrenByParentId.get(campaign.id) ?? []).map((child) => {
                  const entry = progressByCampaignId.get(child.id)
                  return buildCumulativeCampaignDispatchProgress({
                    campaignId: child.id,
                    totalRecipients: child.totalRecipients ?? 0,
                    activeDispatch: entry?.activeDispatch ?? null,
                    latestDispatch: entry?.latestDispatch ?? null,
                    counters: cumulativeByCampaignId.get(child.id) ?? {
                      acceptedCount: 0,
                      failedCount: 0,
                      queuedCount: 0,
                    },
                  })
                })
              : []

          const dispatchProgressSummary =
            subCampaignCount > 0
              ? buildCampaignDispatchProgressSummary(childProgresses)
              : null

          return resolveEmailCreator({
            id: campaign.id,
            name: campaign.name,
            status: effectiveStatus,
            scheduledAt: campaign.scheduledAt,
            sentAt: campaign.sentAt,
            totalRecipients,
            totalSent,
            totalDelivered: childSum?.totalDelivered ?? campaign.totalDelivered,
            totalOpened: childSum?.totalOpened ?? campaign.totalOpened,
            totalClicked: childSum?.totalClicked ?? campaign.totalClicked,
            totalBounced: childSum?.totalBounced ?? campaign.totalBounced,
            dispatchCount: childSum?.dispatchCount ?? campaign.dispatchCount,
            createdAt: campaign.createdAt,
            creator: creatorsById.get(campaign.createdBy) ?? null,
            template: templatesById.get(campaign.templateId) ?? null,
            contactList: campaign.contactListId ? contactListsById.get(campaign.contactListId) ?? null : null,
            radarSegmentSlug: campaign.radarSegmentSlug,
            errorMessage: leafOverride?.status === "sent" ? null : campaign.errorMessage,
            subCampaignCount,
            isParentCampaign: subCampaignCount > 0,
            managedByCorretorStudio: Boolean(campaign.managedByBackofficeUserId),
            // Aproximação rápida na listagem; getById calcula o valor exato pelos logs.
            failedRetryRecipientCount: isLeafRetryStatus
              ? Math.max(0, totalRecipients - totalSent)
              : undefined,
            activeDispatch: subCampaignCount === 0 ? leafProgress?.activeDispatch ?? null : null,
            latestDispatch: subCampaignCount === 0 ? leafProgress?.latestDispatch ?? null : null,
            dispatchProgressSummary,
          })
        }),
        total,
        page: options.page,
        pageSize: options.pageSize,
        totalPages: Math.ceil(total / options.pageSize),
      })
    } catch (error) {
      console.error("[EmailCampaignUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar campanhas"], null)
    }
  }

  async getById(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const campaign = await this.db.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId },
        include: {
          template: { select: { id: true, name: true, subject: true } },
          contactList: { select: { id: true, name: true, totalContacts: true } },
          subCampaigns: {
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
              scheduledAt: true,
              sentAt: true,
              totalRecipients: true,
              totalSent: true,
              totalDelivered: true,
              totalOpened: true,
              totalClicked: true,
              totalBounced: true,
              dispatchCount: true,
              subCampaignIndex: true,
              contactListId: true,
              templateId: true,
              errorMessage: true,
            },
            orderBy: { subCampaignIndex: "asc" },
          },
        },
      })

      if (!campaign) {
        return new Output(false, [], ["Campanha não encontrada"], null)
      }

      const isParent = campaign.subCampaigns.length > 0

      // Self-healing: corrige status terminal desatualizado antes de montar a resposta.
      if (isParent) {
        const subOverrides = await this.reconcileLeafCampaignStatuses(
          ctx,
          campaign.subCampaigns.map((sub) => ({
            id: sub.id,
            status: sub.status,
            totalRecipients: sub.totalRecipients,
            dispatchCount: sub.dispatchCount,
          }))
        )
        for (const sub of campaign.subCampaigns) {
          const override = subOverrides.get(sub.id)
          if (override) {
            sub.status = override.status
            sub.totalSent = override.totalSent
          }
        }
        const refreshedParent = await this.refreshParentCampaignStatus(campaign.id).catch(
          (error) => {
            console.error("[EmailCampaignUseCase][getById][refreshParent]", {
              campaignId: campaign.id,
              error,
            })
            return null
          }
        )
        if (refreshedParent) {
          campaign.status = refreshedParent.status
          campaign.dispatchCount = refreshedParent.dispatchCount
        }
      } else {
        const overrides = await this.reconcileLeafCampaignStatuses(ctx, [
          {
            id: campaign.id,
            status: campaign.status,
            totalRecipients: campaign.totalRecipients,
            dispatchCount: campaign.dispatchCount,
          },
        ])
        const override = overrides.get(campaign.id)
        if (override) {
          campaign.status = override.status
          campaign.totalSent = override.totalSent
          if (override.status === "sent") campaign.errorMessage = null
        }
      }
      const hasAudienceSnapshot = campaign.audienceContactIds.length > 0
      const activeRecipientCount =
        isParent || hasAudienceSnapshot
          ? campaign.totalRecipients
          : await this.countActiveRecipients(ctx.teamId, {
              contactListId: campaign.contactListId,
              radarSegmentSlug: campaign.radarSegmentSlug,
            })

      const childTotals = isParent
        ? campaign.subCampaigns.reduce(
            (acc, child) => ({
              totalSent: acc.totalSent + child.totalSent,
              totalDelivered: acc.totalDelivered + child.totalDelivered,
              totalOpened: acc.totalOpened + child.totalOpened,
              totalClicked: acc.totalClicked + child.totalClicked,
              totalBounced: acc.totalBounced + child.totalBounced,
            }),
            {
              totalSent: 0,
              totalDelivered: 0,
              totalOpened: 0,
              totalClicked: 0,
              totalBounced: 0,
            }
          )
        : null

      const sourceContactListIds =
        campaign.sourceContactListIds.length > 0
          ? campaign.sourceContactListIds
          : isParent
            ? Array.from(
                new Set(
                  campaign.subCampaigns
                    .map((child) => child.contactListId)
                    .filter((id): id is string => Boolean(id))
                )
              )
            : []

      const linkedForm = await detectLinkedFormFromTemplateHtml(
        ctx.teamId,
        (
          await this.db.emailTemplate.findFirst({
            where: { id: campaign.templateId, teamId: ctx.teamId },
            select: { html: true },
          })
        )?.html ?? null
      )

      const failedRetryRecipientCount =
        !isParent && RETRY_FAILED_ONLY_STATUSES.has(campaign.status)
          ? await this.computeFailedRetryRecipientCount({
              campaignId: campaign.id,
              fallbackAudienceCount: activeRecipientCount,
            })
          : undefined

      // Contagem por sub-campanha exibida no diálogo de confirmação. Usa a mesma fonte
      // real (por logs, com fallback de "sem log algum") do objeto de topo — nunca a
      // fórmula frouxa `totalRecipients - totalSent`, que promete o que o backend não
      // cumpre quando já existem logs parciais.
      const subFailedRetryCountById = new Map<string, number>()
      await Promise.all(
        campaign.subCampaigns
          .filter((sub) => RETRY_FAILED_ONLY_STATUSES.has(sub.status))
          .map(async (sub) => {
            const count = await this.computeFailedRetryRecipientCount({
              campaignId: sub.id,
              fallbackAudienceCount: sub.totalRecipients,
            })
            subFailedRetryCountById.set(sub.id, count)
          })
      )

      const progressCampaignMeta = isParent
        ? campaign.subCampaigns.map((sub) => ({ id: sub.id, status: sub.status }))
        : [{ id: campaign.id, status: campaign.status }]

      const progressByCampaignId = await this.loadDispatchProgressForCampaignIds(
        ctx.teamId,
        progressCampaignMeta
      )

      const cumulativeByCampaignId = isParent
        ? await this.aggregateCumulativeLogCountersByCampaignId(
            ctx.teamId,
            campaign.subCampaigns.map((sub) => sub.id)
          )
        : new Map<string, DispatchLogCounters>()

      const leafProgress = progressByCampaignId.get(campaign.id)
      const childProgressList = isParent
        ? campaign.subCampaigns.map((sub) => {
            const entry = progressByCampaignId.get(sub.id)
            return buildCumulativeCampaignDispatchProgress({
              campaignId: sub.id,
              totalRecipients: sub.totalRecipients ?? 0,
              activeDispatch: entry?.activeDispatch ?? null,
              latestDispatch: entry?.latestDispatch ?? null,
              counters: cumulativeByCampaignId.get(sub.id) ?? {
                acceptedCount: 0,
                failedCount: 0,
                queuedCount: 0,
              },
            })
          })
        : []

      return new Output(true, [], [], resolveEmailCreator({
        ...campaign,
        sourceContactListIds,
        linkedForm,
        totalRecipients: ["draft", "scheduled", "sending"].includes(campaign.status)
          ? activeRecipientCount
          : campaign.totalRecipients,
        failedRetryRecipientCount,
        partiallySentCount: isParent
          ? campaign.subCampaigns.filter((sub) => sub.status === "sent").length
          : undefined,
        partiallySentTotal: isParent ? campaign.subCampaigns.length : undefined,
        ...(childTotals ?? {}),
        subCampaignCount: campaign.subCampaigns.length,
        isParentCampaign: isParent,
        managedByCorretorStudio: Boolean(campaign.managedByBackofficeUserId),
        activeDispatch: !isParent ? leafProgress?.activeDispatch ?? null : null,
        latestDispatch: !isParent ? leafProgress?.latestDispatch ?? null : null,
        dispatchProgressSummary: isParent
          ? buildCampaignDispatchProgressSummary(childProgressList)
          : null,
        subCampaigns: campaign.subCampaigns.map((sub) => {
          const subProgress = progressByCampaignId.get(sub.id)
          return {
            ...sub,
            failedRetryRecipientCount: RETRY_FAILED_ONLY_STATUSES.has(sub.status)
              ? subFailedRetryCountById.get(sub.id) ?? 0
              : undefined,
            activeDispatch: subProgress?.activeDispatch ?? null,
            latestDispatch: subProgress?.latestDispatch ?? null,
          }
        }),
      }))
    } catch (error) {
      console.error("[EmailCampaignUseCase][getById]", error)
      return new Output(false, [], ["Erro ao buscar campanha"], null)
    }
  }

  async create(data: CreateCampaignInput, ctx: TeamContext): Promise<Output> {
    try {
      if (!data.name?.trim()) {
        return new Output(false, [], ["Nome da campanha é obrigatório"], null)
      }

      const teamSettings = await this.db.emailTeamSettings
        .findUnique({
          where: { teamId: ctx.teamId },
          select: { dispatchAllowedRoles: true },
        })
        .catch(() => null)

      if (!canDispatchEmail(ctx, teamSettings)) {
        return new Output(false, [], ["Seu perfil não tem permissão para criar campanhas"], null)
      }

      const contactListIds = normalizeContactListIds(data)
      const hasLists = contactListIds.length > 0
      const hasRadar = Boolean(data.radarSegmentSlug)

      if (!hasLists && !hasRadar) {
        return new Output(false, [], ["Selecione uma lista de contatos ou um segmento Radar"], null)
      }
      if (data.radarSegmentSlug && !(await isValidRadarSegmentAudience(ctx.teamId, data.radarSegmentSlug))) {
        return new Output(false, [], ["Segmento Radar inválido"], null)
      }
      if (hasRadar && hasLists && data.listStrategy === "per_list") {
        return new Output(
          false,
          [],
          ["Estratégia por lista não é compatível com segmento Radar. Use juntar listas (merge)"],
          null
        )
      }

      const template = await this.findCurrentPublishedTemplate(data.templateId, ctx.teamId)

      if (!template) {
        return new Output(
          false,
          [],
          ["Template não encontrado ou não é a versão publicada atual. Selecione a versão vigente do template"],
          null
        )
      }

      const savedSegment = await this.maybeSaveAsRadarSegment(ctx.teamId, ctx.profileId, data)
      if (savedSegment.error) {
        return new Output(false, [], [savedSegment.error], null)
      }
      const effectiveRadarSlug = savedSegment.radarSegmentSlug

      const schedule = this.parseScheduleInput(data)
      const trimmedName = data.name.trim()
      const teamLimits = await resolveTeamEmailCampaignLimits(ctx.teamId)
      const maxPerSub = teamLimits.maxRecipientsPerSub

      // Segmento + lista(s): união dedupe → valida schedule → materializa e-mails só-de-segmento → split
      if (hasRadar && hasLists) {
        const { contacts, error: resolveError } = await this.resolveCombinedAudience(
          ctx.teamId,
          contactListIds,
          effectiveRadarSlug
        )
        if (resolveError) return new Output(false, [], [resolveError], null)
        if (contacts.length === 0) {
          return new Output(false, [], ["Nenhum destinatário na audiência combinada"], null)
        }

        // Valida agendamento antes de materializar — evita lista/contatos órfãos em schedule inválido
        const previewIds = contacts.map((contact, index) =>
          contact.contactId ?? `preview-segment-${index}`
        )
        const schedulePreviewPlan = buildCampaignPlanFromContactIds({
          campaignName: trimmedName,
          contactIds: previewIds,
          sourceContactListIds: contactListIds,
          maxRecipientsPerSub: maxPerSub,
          contactListId: contactListIds.length === 1 ? contactListIds[0] : null,
          ...schedule,
        })
        const scheduleError = validateCampaignPlanSchedules(schedulePreviewPlan, schedule)
        if (scheduleError) {
          return new Output(false, [], [scheduleError], null)
        }

        const materialized = await this.materializeMissingContactIds({
          teamId: ctx.teamId,
          profileId: ctx.profileId,
          campaignName: trimmedName,
          contacts,
        })
        if (materialized.error) return new Output(false, [], [materialized.error], null)

        const plan = buildCampaignPlanFromContactIds({
          campaignName: trimmedName,
          contactIds: materialized.contactIds,
          sourceContactListIds: contactListIds,
          maxRecipientsPerSub: maxPerSub,
          contactListId: contactListIds.length === 1 ? contactListIds[0] : null,
          ...schedule,
        })

        const customSegmentId = effectiveRadarSlug?.startsWith(CUSTOM_RADAR_SEGMENT_PREFIX)
          ? effectiveRadarSlug.slice(CUSTOM_RADAR_SEGMENT_PREFIX.length)
          : null

        const createCombinedInDb = async (db: Prisma.TransactionClient | typeof prisma) => {
          if (!plan.isParentCampaign) {
            const single = plan.subCampaigns[0]
            return db.emailCampaign.create({
              data: {
                id: randomUUID(),
                teamId: ctx.teamId,
                createdBy: ctx.profileId,
                name: trimmedName,
                description: data.description?.trim() ? data.description.trim() : null,
                templateId: data.templateId,
                contactListId:
                  single?.contactListId ??
                  (contactListIds.length === 1 ? contactListIds[0] ?? null : null),
                radarSegmentSlug: effectiveRadarSlug ?? null,
                audienceContactIds: single?.audienceContactIds ?? materialized.contactIds,
                sourceContactListIds: contactListIds,
                status: single?.scheduledAt ? "scheduled" : "draft",
                scheduledAt: single?.scheduledAt ? new Date(single.scheduledAt) : null,
                totalRecipients: plan.totalRecipients,
              },
            })
          }

          const parentId = randomUUID()
          const parentStatus: EmailCampaignStatus = plan.subCampaigns.some((sub) => sub.scheduledAt)
            ? "scheduled"
            : "draft"

          const parent = await db.emailCampaign.create({
            data: {
              id: parentId,
              teamId: ctx.teamId,
              createdBy: ctx.profileId,
              name: trimmedName,
              description: data.description?.trim() ? data.description.trim() : null,
              templateId: data.templateId,
              contactListId: contactListIds.length === 1 ? contactListIds[0] ?? null : null,
              radarSegmentSlug: effectiveRadarSlug ?? null,
              sourceContactListIds: contactListIds,
              status: parentStatus,
              scheduledAt: null,
              totalRecipients: plan.totalRecipients,
            },
          })

          const subCampaigns = []
          for (const sub of plan.subCampaigns) {
            const child = await db.emailCampaign.create({
              data: {
                id: randomUUID(),
                teamId: ctx.teamId,
                createdBy: ctx.profileId,
                name: sub.name,
                description: data.description?.trim() ? data.description.trim() : null,
                templateId: data.templateId,
                contactListId: sub.contactListId ?? null,
                parentCampaignId: parentId,
                subCampaignIndex: sub.index,
                audienceContactIds: sub.audienceContactIds ?? [],
                status: sub.scheduledAt ? "scheduled" : "draft",
                scheduledAt: sub.scheduledAt ? new Date(sub.scheduledAt) : null,
                totalRecipients: sub.totalRecipients,
              },
              select: {
                id: true,
                name: true,
                description: true,
                subCampaignIndex: true,
                scheduledAt: true,
                totalRecipients: true,
                status: true,
              },
            })
            subCampaigns.push(child)
          }

          return { ...parent, subCampaigns, subCampaignCount: subCampaigns.length, isParentCampaign: true }
        }

        const createCombined = async () => {
          if (!plan.isParentCampaign) {
            return createCombinedInDb(prisma)
          }
          return this.db.$transaction(async (tx) => createCombinedInDb(tx))
        }

        if (!customSegmentId) {
          const result = await createCombined()
          const message = plan.isParentCampaign
            ? "Campanha criada com sub-campanhas"
            : "Campanha criada com sucesso"
          return new Output(true, [message], [], result)
        }

        // Mantém o advisory lock até a campanha existir (evita remoção concorrente do segmento)
        const created = await this.db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${radarSegmentLockKey(ctx.teamId, customSegmentId)}))`
          const stillActive = await tx.teamRadarSegment.findFirst({
            where: { id: customSegmentId, teamId: ctx.teamId, isActive: true },
          })
          if (!stillActive) return null
          return createCombinedInDb(tx)
        })
        if (!created) {
          return new Output(false, [], ["Segmento Radar inválido"], null)
        }

        const message = plan.isParentCampaign
          ? "Campanha criada com sub-campanhas"
          : "Campanha criada com sucesso"
        return new Output(true, [message], [], created)
      }

      // Somente segmento: rejeita acima do limite (DA11 — sem split)
      if (hasRadar) {
        const totalRecipients = await this.countActiveRecipients(ctx.teamId, {
          radarSegmentSlug: effectiveRadarSlug,
        })
        if (requiresSubCampaignSplit(totalRecipients, maxPerSub)) {
          const limitLabel =
            maxPerSub?.toLocaleString("pt-BR") ??
            EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")
          return new Output(
            false,
            [],
            [
              `Audiência excede o limite de ${limitLabel} destinatários por campanha de segmento. Refine as condições ou materialize em lista de contatos (listas podem usar sub-campanhas)`,
            ],
            null
          )
        }
        if (schedule.scheduledAt && schedule.scheduledAt <= new Date()) {
          return new Output(false, [], ["Data de agendamento deve ser no futuro"], null)
        }
        const campaignData = {
          id: randomUUID(),
          teamId: ctx.teamId,
          createdBy: ctx.profileId,
          name: trimmedName,
          description: data.description?.trim() ? data.description.trim() : null,
          templateId: data.templateId,
          contactListId: null,
          radarSegmentSlug: effectiveRadarSlug ?? null,
          status: (schedule.scheduledAt ? "scheduled" : "draft") as EmailCampaignStatus,
          scheduledAt: schedule.scheduledAt,
          totalRecipients,
        }

        const customSegmentId = effectiveRadarSlug?.startsWith(CUSTOM_RADAR_SEGMENT_PREFIX)
          ? effectiveRadarSlug.slice(CUSTOM_RADAR_SEGMENT_PREFIX.length)
          : null

        if (!customSegmentId) {
          const campaign = await this.db.emailCampaign.create({ data: campaignData })
          return new Output(true, ["Campanha criada com sucesso"], [], campaign)
        }

        const campaign = await this.db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${radarSegmentLockKey(ctx.teamId, customSegmentId)}))`

          const stillActive = await tx.teamRadarSegment.findFirst({
            where: { id: customSegmentId, teamId: ctx.teamId, isActive: true },
          })
          if (!stillActive) return null

          return tx.emailCampaign.create({ data: campaignData })
        })

        if (!campaign) {
          return new Output(false, [], ["Segmento Radar inválido"], null)
        }
        return new Output(true, ["Campanha criada com sucesso"], [], campaign)
      }

      const listStrategy = resolveListStrategy(data)
      if (contactListIds.length > 1 && data.listStrategy !== "merge" && data.listStrategy !== "per_list") {
        return new Output(false, [], ["Selecione a estratégia de uso das listas (merge ou per_list)"], null)
      }

      const { slices, error } = await this.loadListAudiences(ctx.teamId, contactListIds)
      if (error) return new Output(false, [], [error], null)

      const plan = buildCampaignPlan({
        campaignName: trimmedName,
        listStrategy,
        sourceContactListIds: listStrategy === "merge" ? contactListIds : contactListIds,
        listAudiences: slices,
        maxRecipientsPerSub: maxPerSub,
        ...schedule,
      })

      const scheduleError = validateCampaignPlanSchedules(plan, schedule)
      if (scheduleError) {
        return new Output(false, [], [scheduleError], null)
      }

      if (!plan.isParentCampaign) {
        const single = plan.subCampaigns[0]
        const campaign = await this.db.emailCampaign.create({
          data: {
            id: randomUUID(),
            teamId: ctx.teamId,
            createdBy: ctx.profileId,
            name: trimmedName,
            description: data.description?.trim() ? data.description.trim() : null,
            templateId: data.templateId,
            contactListId: single?.contactListId ?? (listStrategy === "single" ? (contactListIds[0] ?? null) : null),
            audienceContactIds: single?.audienceContactIds ?? [],
            sourceContactListIds: listStrategy === "merge" ? contactListIds : [],
            status: single?.scheduledAt ? "scheduled" : "draft",
            scheduledAt: single?.scheduledAt ? new Date(single.scheduledAt) : null,
            totalRecipients: plan.totalRecipients,
          },
        })
        return new Output(true, ["Campanha criada com sucesso"], [], campaign)
      }

      const parentId = randomUUID()
      const parentStatus: EmailCampaignStatus = plan.subCampaigns.some((sub) => sub.scheduledAt)
        ? "scheduled"
        : "draft"

      const result = await this.db.$transaction(async (tx) => {
        const parent = await tx.emailCampaign.create({
          data: {
            id: parentId,
            teamId: ctx.teamId,
            createdBy: ctx.profileId,
            name: trimmedName,
            description: data.description?.trim() ? data.description.trim() : null,
            templateId: data.templateId,
            contactListId: listStrategy === "single" ? contactListIds[0] ?? null : null,
            sourceContactListIds: listStrategy === "merge" ? contactListIds : [],
            status: parentStatus,
            scheduledAt: null,
            totalRecipients: plan.totalRecipients,
          },
        })

        const subCampaigns = []
        for (const sub of plan.subCampaigns) {
          const subTemplateId =
            data.subCampaignTemplates?.find((t) => t.index === sub.index)?.templateId ??
            data.templateId
          const child = await tx.emailCampaign.create({
            data: {
              id: randomUUID(),
              teamId: ctx.teamId,
              createdBy: ctx.profileId,
              name: sub.name,
              description: data.description?.trim() ? data.description.trim() : null,
              templateId: subTemplateId,
              contactListId: sub.contactListId ?? (listStrategy === "single" ? contactListIds[0] ?? null : null),
              parentCampaignId: parentId,
              subCampaignIndex: sub.index,
              audienceContactIds: sub.audienceContactIds ?? [],
              status: sub.scheduledAt ? "scheduled" : "draft",
              scheduledAt: sub.scheduledAt ? new Date(sub.scheduledAt) : null,
              totalRecipients: sub.totalRecipients,
            },
            select: {
              id: true,
              name: true,
              description: true,
              subCampaignIndex: true,
              scheduledAt: true,
              totalRecipients: true,
              status: true,
            },
          })
          subCampaigns.push(child)
        }

        return { ...parent, subCampaigns, subCampaignCount: subCampaigns.length, isParentCampaign: true }
      })

      return new Output(true, ["Campanha criada com sub-campanhas"], [], result)
    } catch (error) {
      console.error("[EmailCampaignUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar campanha"], null)
    }
  }

  async update(id: string, data: UpdateCampaignInput, ctx: TeamContext): Promise<Output> {
    try {
      const editableStatuses = ["draft", "scheduled"] as const
      const existing = await this.db.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: [...editableStatuses] } },
      })

      if (!existing) {
        const campaign = await this.db.emailCampaign.findFirst({
          where: { id, teamId: ctx.teamId },
          select: { status: true },
        })
        if (!campaign) {
          return new Output(false, [], ["Campanha não encontrada"], null)
        }
        if (campaign.status === "sending") {
          return new Output(false, [], ["Campanha em envio não pode ser editada"], null)
        }
        if (campaign.status === "archived") {
          return new Output(false, [], ["Campanha arquivada não pode ser editada"], null)
        }
        return new Output(false, [], ["Campanha não pode ser editada no status atual"], null)
      }

      const canChangeSchedule = existing.status === "draft" || existing.status === "scheduled"
      const isParentCampaign =
        (await this.db.emailCampaign.count({ where: { parentCampaignId: id, teamId: ctx.teamId } })) > 0
      const teamLimits = await resolveTeamEmailCampaignLimits(ctx.teamId)
      const maxPerSub = teamLimits.maxRecipientsPerSub

      if (isParentCampaign && data.scheduledAt !== undefined) {
        return new Output(
          false,
          [],
          ["Campanha-pai não possui agendamento próprio. Edite as sub-campanhas"],
          null
        )
      }

      if (data.templateId !== undefined) {
        const template = await this.findCurrentPublishedTemplate(data.templateId, ctx.teamId)
        if (!template) {
          return new Output(
            false,
            [],
            ["Template não encontrado ou não é a versão publicada atual. Selecione a versão vigente do template"],
            null
          )
        }
      }

      let totalRecipients: number | undefined
      const audienceTouched =
        data.contactListId !== undefined ||
        data.contactListIds !== undefined ||
        data.radarSegmentSlug !== undefined ||
        data.listStrategy !== undefined

      if (audienceTouched) {
        if (existing.audienceContactIds.length > 0 || isParentCampaign) {
          return new Output(
            false,
            [],
            ["Audiência de sub-campanha não pode ser alterada após a criação"],
            null
          )
        }
        const nextContactListId = data.contactListId !== undefined ? data.contactListId : existing.contactListId
        const nextSegmentSlug =
          data.radarSegmentSlug !== undefined ? data.radarSegmentSlug : existing.radarSegmentSlug
        totalRecipients = await this.countActiveRecipients(ctx.teamId, {
          contactListId: nextContactListId,
          radarSegmentSlug: nextSegmentSlug,
        })
        // Só rejeita por limite de segmento quando NÃO há lista (DA11). Com lista, união materializa.
        if (nextSegmentSlug && !nextContactListId && requiresSubCampaignSplit(totalRecipients, maxPerSub)) {
          const limitLabel =
            maxPerSub?.toLocaleString("pt-BR") ??
            EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")
          return new Output(
            false,
            [],
            [
              `Audiência excede o limite de ${limitLabel} destinatários por campanha de segmento. Refine as condições ou materialize em lista de contatos (listas podem usar sub-campanhas)`,
            ],
            null
          )
        }
      }

      if (data.subCampaignUpdates?.length) {
        if (!isParentCampaign) {
          return new Output(false, [], ["Campanha não possui sub-campanhas para atualizar"], null)
        }

        for (const subUpdate of data.subCampaignUpdates) {
          const child = await this.db.emailCampaign.findFirst({
            where: {
              id: subUpdate.id,
              parentCampaignId: id,
              teamId: ctx.teamId,
              status: { in: ["draft", "scheduled"] },
            },
          })
          if (!child) {
            return new Output(false, [], ["Sub-campanha não encontrada ou não pode ser editada"], null)
          }

          if (subUpdate.scheduledAt !== undefined) {
            const nextScheduledAt = subUpdate.scheduledAt ? new Date(subUpdate.scheduledAt) : null
            if (nextScheduledAt) {
              const siblingConflict = await this.hasSiblingDailyCapConflict({
                teamId: ctx.teamId,
                parentCampaignId: id,
                campaignId: subUpdate.id,
                scheduledAt: nextScheduledAt,
                totalRecipients: child.totalRecipients,
              })
              if (siblingConflict) {
                return new Output(
                  false,
                  [],
                  [
                    `O agendamento ultrapassa o limite de ${EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB} e-mails por dia com outras sub-campanhas`,
                  ],
                  null
                )
              }
            }
          }

          let nextTemplateId: string | undefined
          if (subUpdate.templateId !== undefined) {
            const template = await this.findCurrentPublishedTemplate(subUpdate.templateId, ctx.teamId)
            if (!template) {
              return new Output(false, [], ["Template da sub-campanha não encontrado ou não publicado"], null)
            }
            nextTemplateId = template.id
          }

          await this.db.emailCampaign.update({
            where: { id: subUpdate.id },
            data: {
              ...(subUpdate.name !== undefined && { name: subUpdate.name.trim() }),
              ...(subUpdate.scheduledAt !== undefined && {
                scheduledAt: subUpdate.scheduledAt ? new Date(subUpdate.scheduledAt) : null,
                status: subUpdate.scheduledAt ? "scheduled" : "draft",
              }),
              ...(subUpdate.contactListId !== undefined &&
                child.audienceContactIds.length === 0 && {
                  contactListId: subUpdate.contactListId,
                }),
              ...(nextTemplateId !== undefined && { templateId: nextTemplateId }),
            },
          })
        }
      }

      if (
        canChangeSchedule &&
        data.scheduledAt !== undefined &&
        data.scheduledAt &&
        existing.parentCampaignId
      ) {
        const nextScheduledAt = new Date(data.scheduledAt)
        const siblingConflict = await this.hasSiblingDailyCapConflict({
          teamId: ctx.teamId,
          parentCampaignId: existing.parentCampaignId,
          campaignId: id,
          scheduledAt: nextScheduledAt,
          totalRecipients: existing.totalRecipients,
        })
        if (siblingConflict) {
          const limitLabel =
            maxPerSub?.toLocaleString("pt-BR") ??
            EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")
          return new Output(
            false,
            [],
            [
              `O agendamento ultrapassa o limite de ${limitLabel} e-mails por dia com outras sub-campanhas`,
            ],
            null
          )
        }
      }

      const campaign = await this.db.emailCampaign.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.description !== undefined && {
            description: data.description?.trim() ? data.description.trim() : null,
          }),
          ...(data.templateId !== undefined && { templateId: data.templateId }),
          ...(data.contactListId !== undefined && { contactListId: data.contactListId }),
          ...(data.radarSegmentSlug !== undefined && {
            radarSegmentSlug: data.radarSegmentSlug,
          }),
          ...(totalRecipients !== undefined && { totalRecipients }),
          ...(canChangeSchedule && data.scheduledAt !== undefined && {
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
            status: data.scheduledAt ? "scheduled" : "draft",
          }),
        },
      })

      const resolvedRecipientCount = await this.countActiveRecipients(ctx.teamId, {
        contactListId: campaign.contactListId,
        radarSegmentSlug: campaign.radarSegmentSlug,
      })

      return new Output(true, ["Campanha atualizada com sucesso"], [], {
        ...campaign,
        totalRecipients: ["draft", "scheduled", "sending", "sent", "failed", "partially_sent"].includes(campaign.status)
          ? resolvedRecipientCount
          : campaign.totalRecipients,
      })
    } catch (error) {
      console.error("[EmailCampaignUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar campanha"], null)
    }
  }

  private async getNextDispatchNumber(campaignId: string): Promise<number> {
    const { _max } = await this.db.emailCampaignDispatch.aggregate({
      where: { campaignId },
      _max: { dispatchNumber: true },
    })
    return (_max.dispatchNumber ?? 0) + 1
  }

  private partitionRecipientsByEmailValidity<T extends { email: string }>(
    recipients: T[]
  ): { valid: T[]; invalid: Array<T & { reason: string }> } {
    const valid: T[] = []
    const invalid: Array<T & { reason: string }> = []

    for (const recipient of recipients) {
      const validation = isValidResendRecipientEmail(recipient.email)
      if (!validation.ok) {
        invalid.push({ ...recipient, reason: validation.reason })
        continue
      }
      valid.push({ ...recipient, email: validation.email })
    }

    return { valid, invalid }
  }

  private buildFailureReasonByEmail(providerErrors: DispatchProviderError[]): Map<string, string> {
    const byEmail = new Map<string, string>()
    for (const error of providerErrors) {
      const message =
        typeof error.statusCode === "number"
          ? `${error.statusCode} — ${error.message}`
          : error.message
      for (const email of error.emails) {
        if (!byEmail.has(email)) {
          byEmail.set(email, message)
        }
      }
    }
    return byEmail
  }

  private buildDispatchFailureDetail(
    providerErrors: DispatchProviderError[],
    abortedReason?: "domain_not_verified"
  ): string | null {
    if (providerErrors.length === 0) return null

    for (const error of providerErrors) {
      const technical = formatProviderBatchFailureMessage({
        message: error.message,
        statusCode: error.statusCode,
        emails: error.emails,
      })
      console.error("[EmailCampaignUseCase][buildDispatchFailureDetail] erro técnico:", technical)
    }

    if (abortedReason === "domain_not_verified") {
      return "Domínio de envio não verificado. Verifique os registros DNS nas configurações de e-mail."
    }

    const totalFailed = providerErrors.reduce((sum, e) => sum + e.emails.length, 0)
    const has409 = providerErrors.some((e) => e.statusCode === 409)

    if (has409) {
      return "Campanha já foi processada anteriormente. Se o problema persistir, entre em contato com o suporte."
    }

    return `Falha no envio. ${totalFailed} destinatário(s) não foram enviados.`
  }

  private recordDispatchLeadActivities(params: {
    teamId: string
    campaignId: string
    dispatchId: string
    recipients: Array<{ email: string; name?: string | null; customFields?: Record<string, unknown> | null }>
    dispatchedEmails: Set<string>
    subject: string
    globalDefaults: Record<string, string>
    templateVariables: ReturnType<EmailCampaignRecipientService["parseTemplateVariables"]>
  }): void {
    const jobs = params.recipients
      .filter((recipient) => params.dispatchedEmails.has(recipient.email))
      .map((recipient) => ({
        recipientEmail: recipient.email,
        subject: interpolateEmailTemplate(
          params.subject,
          recipient,
          params.globalDefaults,
          params.templateVariables
        ),
      }))

    void withConcurrencyLimit(jobs, EMAIL_LOG_WRITE_CONCURRENCY_LIMIT, async (job) => {
      try {
        await emailCampaignLeadActivityService.recordDispatchForRecipient({
          teamId: params.teamId,
          campaignId: params.campaignId,
          dispatchId: params.dispatchId,
          recipientEmail: job.recipientEmail,
          subject: job.subject,
        })
      } catch (activityError) {
        console.error("[EmailCampaignUseCase][recordDispatchLeadActivities]", activityError)
      }
    })
  }

  private async reserveTeamCreditsForDispatch(
    teamId: string,
    recipientCount: number,
    hasBetaAccess: boolean
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    if (hasBetaAccess || recipientCount <= 0) {
      return { ok: true }
    }

    const result = await this.creditService.reserveCredits(teamId, recipientCount)
    if (result.ok) {
      return { ok: true }
    }

    if (result.reason === "no_subscription") {
      return { ok: false, message: EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_CREDITS }
    }

    return {
      ok: false,
      message: this.creditService.formatInsufficientCreditsMessage(recipientCount, result.available),
    }
  }

  private async releaseUnusedTeamCredits(
    teamId: string,
    reservedCount: number,
    sentCount: number,
    hasBetaAccess: boolean
  ): Promise<void> {
    if (hasBetaAccess || reservedCount <= 0) return
    const unused = Math.max(0, reservedCount - sentCount)
    if (unused > 0) {
      await this.creditService.releaseCredits(teamId, unused)
    }
  }

  private async refreshParentCampaignStatusForChild(campaignId: string): Promise<void> {
    const campaign = await this.db.emailCampaign.findFirst({
      where: { id: campaignId },
      select: { parentCampaignId: true },
    })
    if (campaign?.parentCampaignId) {
      await this.refreshParentCampaignStatus(campaign.parentCampaignId)
    }
  }

  /**
   * Lista e-mails da campanha elegíveis para "Redisparar falhas".
   * Ver critério em `lib/email/campaign-failed-recipients.ts`.
   */
  private async resolveFailedRetryRecipientEmails(campaignId: string): Promise<string[]> {
    const logs = await this.db.emailLog.findMany({
      where: {
        campaignId,
        status: {
          in: [
            CAMPAIGN_RETRY_FAILURE_LOG_STATUS,
            ...CAMPAIGN_PROVIDER_SUCCESS_LOG_STATUSES,
            ...CAMPAIGN_RETRY_EXCLUDE_LOG_STATUSES,
          ],
        },
      },
      select: { recipientEmail: true, status: true },
    })

    return selectFailedRecipientEmailsForRetry(logs)
  }

  /**
   * Resolve os e-mails a redisparar no modo "reenviar apenas falhas", cobrindo o caso
   * em que a tentativa anterior falhou **antes** de criar qualquer `EmailLog` (ex.:
   * validação de variáveis). Sem log algum + status retriável ⇒ toda a audiência
   * resolvida é reenviada (ninguém recebeu). Ver `resolveRetryRecipientEmails`.
   */
  private async resolveRetryRecipientEmailsForDispatch(
    campaignId: string,
    hasRetriableStatus: boolean,
    resolvedAudienceEmails: string[]
  ): Promise<{ emails: string[]; hadAnyLog: boolean }> {
    const logs = await this.db.emailLog.findMany({
      where: {
        campaignId,
        status: {
          in: [
            CAMPAIGN_RETRY_FAILURE_LOG_STATUS,
            ...CAMPAIGN_PROVIDER_SUCCESS_LOG_STATUSES,
            ...CAMPAIGN_RETRY_EXCLUDE_LOG_STATUSES,
          ],
        },
      },
      select: { recipientEmail: true, status: true },
    })

    const hasAnyLog =
      logs.length > 0 || (await this.db.emailLog.count({ where: { campaignId } })) > 0

    return {
      emails: resolveRetryRecipientEmails({
        hasAnyLog,
        hasRetriableStatus,
        logs,
        resolvedAudienceEmails,
      }),
      hadAnyLog: hasAnyLog,
    }
  }

  /**
   * Contagem exibida na UI ("N destinatário(s) que falharam"). Alinha a fonte com o
   * disparo real: por logs `failed` quando existem, ou toda a audiência quando a
   * campanha é retriável e não há log algum (falha antes de criar `EmailLog`).
   */
  private async computeFailedRetryRecipientCount(params: {
    campaignId: string
    fallbackAudienceCount: number
  }): Promise<number> {
    const failedByLogs = await this.resolveFailedRetryRecipientEmails(params.campaignId)
    if (failedByLogs.length > 0) return failedByLogs.length

    const hasAnyLog =
      (await this.db.emailLog.count({ where: { campaignId: params.campaignId } })) > 0
    return hasAnyLog ? 0 : Math.max(0, params.fallbackAudienceCount)
  }

  async countFailedRetryRecipients(campaignId: string, ctx: TeamContext): Promise<number> {
    const campaign = await this.db.emailCampaign.findFirst({
      where: { id: campaignId, teamId: ctx.teamId },
      select: { id: true, status: true, totalRecipients: true },
    })
    if (!campaign) return 0
    if (!RETRY_FAILED_ONLY_STATUSES.has(campaign.status)) {
      return (await this.resolveFailedRetryRecipientEmails(campaignId)).length
    }
    return this.computeFailedRetryRecipientCount({
      campaignId,
      fallbackAudienceCount: campaign.totalRecipients,
    })
  }

  async startManualDispatch(
    id: string,
    ctx: TeamContext,
    options?: ManualDispatchOptions
  ): Promise<Output> {
    let previousStatus: EmailCampaignStatus | null = null
    let reservedCredits = 0
    let hasCampaignsBetaAccess = false

    try {
      const campaign = await this.db.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: [...MANUAL_DISPATCH_STATUSES] } },
        include: {
          contactList: { select: { id: true, name: true, totalContacts: true } },
          team: { select: { master: { select: { id: true, timezone: true } } } },
        },
      })

      let teamSettings = null
      try {
        teamSettings = await this.db.emailTeamSettings.findUnique({ where: { teamId: ctx.teamId } })
      } catch {
        // fall back to env defaults if model unavailable in current client build
      }

      if (!campaign) {
        return new Output(false, [], ["Campanha não encontrada ou não pode ser disparada"], null)
      }

      if (!canDispatchEmail(ctx, teamSettings)) {
        return new Output(false, [], ["Seu perfil não tem permissão para disparar campanhas"], null)
      }

      previousStatus = campaign.status

      const publishedTemplate = await this.resolvePublishedTemplate(campaign.templateId, ctx.teamId)
      if (!publishedTemplate) {
        return new Output(
          false,
          [],
          ["O template vinculado à campanha não é mais a versão publicada atual. Atualize a campanha antes de disparar"],
          null
        )
      }

      if (teamSettings) {
        type BlockedEntry = { date?: string; from?: string; to?: string }
        const blockedDates = ((teamSettings.dispatchBlockedDates as BlockedEntry[]) ?? [])
        const ownerTz = resolveTimezone(campaign.team.master.timezone)
        const windowCheck = checkDispatchWindow(new Date(), ownerTz, {
          dispatchBlockedDates: blockedDates,
          dispatchTimeFrom: teamSettings.dispatchTimeFrom,
          dispatchTimeTo: teamSettings.dispatchTimeTo,
        })
        if (windowCheck.blocked) {
          return new Output(false, [], [`Disparo bloqueado: ${windowCheck.reason}`], null)
        }
      }

      if (!publishedTemplate.html) {
        return new Output(false, [], ["Template não possui HTML. Edite o template antes de disparar"], null)
      }

      const templateHtml = inlineEmailHtml(publishedTemplate.html)

      const radarBetaAccess = await featureAccessService.resolveRadarBetaAccess({
        profileId: ctx.profileId,
        managerId: ctx.managerId,
        isMaster: ctx.isMaster,
        teamId: ctx.teamId,
      })
      if (!radarBetaAccess) {
        return new Output(false, [], [EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RADAR_BETA], null)
      }

      hasCampaignsBetaAccess = await featureAccessService.resolveEmailBetaAccess({
        profileId: ctx.profileId,
        managerId: ctx.managerId,
        isMaster: ctx.isMaster,
        teamId: ctx.teamId,
      })

      const defaultSender = await this.db.emailTeamSender
        .findFirst({
          where: { teamId: ctx.teamId, isDefault: true },
          select: { name: true, email: true },
        })
        .catch(() => null)

      const parentChildCount = await this.db.emailCampaign.count({
        where: { parentCampaignId: campaign.id, teamId: ctx.teamId },
      })
      if (parentChildCount > 0) {
        return new Output(
          false,
          [],
          ["Campanha-pai não pode ser disparada diretamente. As sub-campanhas seguem o agendamento"],
          null
        )
      }

      const dispatchInput = await this.recipientService.buildCampaignDispatchInput({
        teamId: ctx.teamId,
        contactListId: campaign.contactListId,
        radarSegmentSlug: campaign.radarSegmentSlug,
        audienceContactIds: campaign.audienceContactIds,
        template: {
          subject: publishedTemplate.subject,
          html: templateHtml,
          variables: publishedTemplate.variables,
        },
        teamSettings,
        defaultSender,
        masterTimezone: campaign.team.master.timezone,
      })

      const fromGuard = assertCampaignFromIsSendable({
        resolved: dispatchInput.resolvedFrom,
        domainName: teamSettings?.resendDomainName,
        domainStatus: teamSettings?.resendDomainStatus,
      })
      if (!fromGuard.ok) {
        return new Output(false, [], [fromGuard.message], null)
      }

      // failed/partially_sent: sempre só falhos (mesmo se o client omitir o flag).
      // Evita reenviar a lista inteira e duplicar quem já chegou ao provedor.
      const retryFailedOnly =
        options?.retryFailedOnly === true || RETRY_FAILED_ONLY_STATUSES.has(campaign.status)

      let recipientsForDispatch = dispatchInput.recipients
      if (retryFailedOnly) {
        const { emails: retryEmails, hadAnyLog } = await this.resolveRetryRecipientEmailsForDispatch(
          campaign.id,
          RETRY_FAILED_ONLY_STATUSES.has(campaign.status),
          dispatchInput.recipients.map((recipient) => recipient.email)
        )
        const retryEmailSet = new Set(retryEmails)
        recipientsForDispatch = dispatchInput.recipients.filter((recipient) =>
          retryEmailSet.has(recipient.email.trim().toLowerCase())
        )
        console.info("[EmailCampaignUseCase][startManualDispatch] retryFailedOnly", {
          campaignId: campaign.id,
          previousStatus: campaign.status,
          hadAnyLog,
          fullAudienceCount: dispatchInput.recipients.length,
          failedOnlyCount: recipientsForDispatch.length,
        })
      }

      if (recipientsForDispatch.length === 0) {
        return new Output(
          false,
          [],
          [
            retryFailedOnly
              ? EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_FAILED_RECIPIENTS
              : campaign.radarSegmentSlug
                ? EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_RADAR
                : EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_LIST,
          ],
          null
        )
      }

      const ownerTz = resolveTimezone(campaign.team.master.timezone)
      const dailyCap = await wouldExceedDailyEmailCap({
        teamId: ctx.teamId,
        timezone: ownerTz,
        now: new Date(),
        additionalRecipients: recipientsForDispatch.length,
      })
      if (dailyCap.exceeded && dailyCap.limit != null) {
        return new Output(
          false,
          [],
          [EMAIL_CAMPAIGN_FAILURE_MESSAGES.formatDailyLimit(dailyCap.used, dailyCap.limit)],
          null
        )
      }

      const unresolvedTokens = this.recipientService.findUnresolvedTokensForRecipients({
        subject: dispatchInput.subject,
        html: dispatchInput.html,
        recipients: recipientsForDispatch,
        globalDefaults: dispatchInput.globalDefaults,
        templateVariables: dispatchInput.templateVariables,
      })

      if (unresolvedTokens.length > 0) {
        return new Output(
          false,
          [],
          [`Variáveis sem valor suficiente: ${unresolvedTokens.map((token) => `{{${token}}}`).join(", ")}`],
          null
        )
      }

      const lockResult = await this.db.emailCampaign.updateMany({
        where: { id, teamId: ctx.teamId, status: { in: [...MANUAL_DISPATCH_STATUSES] } },
        data: { status: "sending", errorMessage: null },
      })

      if (lockResult.count === 0) {
        return new Output(false, [], ["Campanha não encontrada ou já está sendo enviada"], null)
      }

      const recipientsList = recipientsForDispatch
      const creditsToReserve = recipientsList.length

      const creditReservation = await this.reserveTeamCreditsForDispatch(
        ctx.teamId,
        creditsToReserve,
        hasCampaignsBetaAccess
      )
      if (!creditReservation.ok) {
        await this.db.emailCampaign.update({
          where: { id },
          data: { status: previousStatus ?? "draft", errorMessage: creditReservation.message },
        })
        return new Output(false, [], [creditReservation.message], null)
      }
      reservedCredits = creditsToReserve

      const dispatchNumber = await this.getNextDispatchNumber(campaign.id)
      const dispatchRecord = await this.db.emailCampaignDispatch.create({
        data: {
          id: randomUUID(),
          campaignId: campaign.id,
          teamId: ctx.teamId,
          dispatchNumber,
          templateId: publishedTemplate.id,
          templateVersionNumber: publishedTemplate.versionNumber,
          templateName: publishedTemplate.name,
          templateSubject: publishedTemplate.subject,
          templateHtml,
          contactListId: campaign.contactListId,
          contactListName: campaign.contactList?.name ?? null,
          radarSegmentSlug: campaign.radarSegmentSlug,
          triggeredBy: ctx.profileId,
          totalRecipients: recipientsList.length,
          status: "sending",
          batchIdempotencyScheme: "contentHash",
          retryFailedOnly,
        },
      })

      const { globalDefaults, templateVariables } = dispatchInput
      const logInputs = recipientsList.map((recipient) => ({
        teamId: ctx.teamId,
        campaignId: campaign.id,
        dispatchId: dispatchRecord.id,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        subject: interpolateEmailTemplate(dispatchInput.subject, recipient, globalDefaults, templateVariables),
        category: "campaign" as const,
        sourceType: "campaign",
        sourceId: campaign.id,
      }))
      const createdLogs = await teamEmailDispatchLogger.createQueuedTeamEmailLogs(logInputs)

      const dispatchWarnings = getResendDomainDispatchWarnings(teamSettings?.resendDomainStatus)

      const job: ManualDispatchJob = {
        campaignId: campaign.id,
        dispatchId: dispatchRecord.id,
        dispatchNumber,
        teamId: ctx.teamId,
        previousStatus: previousStatus ?? "draft",
        reservedCredits,
        hasCampaignsBetaAccess,
        recipients: recipientsList,
        subject: dispatchInput.subject,
        html: dispatchInput.html,
        from: dispatchInput.from,
        replyTo: dispatchInput.replyTo,
        globalDefaults,
        templateVariables,
        logIdsByEmail: createdLogs.map(({ email, logId }) => ({ email, logId })),
        totalRecipients: recipientsList.length,
        retryFailedOnly,
        status: "sending",
        batchIdempotencyScheme: "contentHash",
        ...(dispatchWarnings.length > 0 ? { warnings: dispatchWarnings } : {}),
      }

      return new Output(
        true,
        [
          retryFailedOnly
            ? `Reenvio das falhas iniciado em segundo plano (${recipientsList.length} destinatário(s))`
            : "Disparo iniciado em segundo plano",
          ...dispatchWarnings,
        ],
        [],
        job
      )
    } catch (error) {
      console.error("[EmailCampaignUseCase][startManualDispatch]", error)

      if (reservedCredits > 0) {
        await this.releaseUnusedTeamCredits(
          ctx.teamId,
          reservedCredits,
          0,
          hasCampaignsBetaAccess
        ).catch((releaseError) => {
          console.error("[EmailCampaignUseCase][startManualDispatch] falha ao liberar créditos", releaseError)
        })
      }

      const failureMessage = this.resolveDispatchFailureMessage(
        error,
        EMAIL_CAMPAIGN_FAILURE_MESSAGES.INTERNAL
      )

      const failedCampaign = await this.db.emailCampaign
        .update({
          where: { id },
          data: {
            status:
              previousStatus && MANUAL_DISPATCH_STATUS_SET.has(previousStatus)
                ? previousStatus
                : "failed",
            errorMessage: failureMessage,
          },
          select: { id: true, name: true, status: true },
        })
        .catch(() => null)

      if (failedCampaign?.status === "failed") {
        await this.notifyDispatchFailureIfNeeded({
          recipientProfileId: ctx.profileId,
          teamId: ctx.teamId,
          campaignId: id,
          campaignName: failedCampaign.name,
          errorMessage: failureMessage,
        })
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return new Output(false, [], ["Conflito de numeração de disparo. Tente novamente."], null)
      }

      return new Output(false, [], [failureMessage === EMAIL_CAMPAIGN_FAILURE_MESSAGES.INTERNAL ? "Erro ao disparar campanha" : failureMessage], null)
    }
  }

  async completeManualDispatch(job: ManualDispatchJob): Promise<Output> {
    const logIdsByEmail = new Map(job.logIdsByEmail.map(({ email, logId }) => [email, logId]))
    let sentCount = 0

    try {
      const stillSending = await this.db.emailCampaignDispatch.findFirst({
        where: { id: job.dispatchId, teamId: job.teamId, status: "sending" },
        select: { id: true },
      })
      if (!stillSending) {
        console.info("[EmailCampaignUseCase][completeManualDispatch] dispatch já finalizado", {
          dispatchId: job.dispatchId,
        })
        return new Output(true, ["Disparo já finalizado"], [], {
          campaignId: job.campaignId,
          dispatchId: job.dispatchId,
        })
      }

      try {
        const { valid: validRecipients, invalid: invalidRecipients } =
          this.partitionRecipientsByEmailValidity(job.recipients)

        const dispatchResult =
          validRecipients.length > 0
            ? await this.dispatchService.dispatchBatch({
                from: job.from,
                replyTo: job.replyTo,
                recipients: validRecipients,
                subject: job.subject,
                html: job.html,
                campaignId: job.campaignId,
                teamId: job.teamId,
                dispatchId: job.dispatchId,
                dispatchNumber: job.dispatchNumber,
                batchIdempotencyScheme: job.batchIdempotencyScheme,
                enableContentHashFallbackOnIdempotencyConflict:
                  job.enableContentHashFallbackOnIdempotencyConflict ?? false,
                globalDefaults: job.globalDefaults,
                templateVariables: job.templateVariables,
                logIdByEmail: logIdsByEmail,
                onChunkDispatched: async (chunkDispatched) => {
                  const sentEntries = chunkDispatched.flatMap(({ email, resendId }) => {
                    const logId = logIdsByEmail.get(email)
                    return logId ? [{ logId, resendEmailId: resendId }] : []
                  })
                  if (sentEntries.length > 0) {
                    await teamEmailDispatchLogger.markManyTeamEmailLogsSent(sentEntries)
                  }
                },
              })
            : {
                sent: 0,
                failed: invalidRecipients.length,
                dispatched: [] as Array<{ email: string; resendId: string }>,
                providerErrors: invalidRecipients.map((recipient) => ({
                  message: formatInvalidRecipientFailureMessage(
                    recipient.email,
                    recipient.reason
                  ),
                  emails: [recipient.email],
                })),
                abortedReason: undefined as "domain_not_verified" | undefined,
              }

        sentCount = dispatchResult.sent

        const failureReasonByEmail = this.buildFailureReasonByEmail(dispatchResult.providerErrors)
        for (const recipient of invalidRecipients) {
          if (!failureReasonByEmail.has(recipient.email)) {
            failureReasonByEmail.set(
              recipient.email,
              formatInvalidRecipientFailureMessage(recipient.email, recipient.reason)
            )
          }
        }

        const dispatchedEmails = new Set(dispatchResult.dispatched.map((entry) => entry.email))
        this.recordDispatchLeadActivities({
          teamId: job.teamId,
          campaignId: job.campaignId,
          dispatchId: job.dispatchId,
          recipients: job.recipients,
          dispatchedEmails,
          subject: job.subject,
          globalDefaults: job.globalDefaults,
          templateVariables: job.templateVariables,
        })
        await withConcurrencyLimit(
          job.recipients.filter((recipient) => !dispatchedEmails.has(recipient.email)),
          EMAIL_LOG_WRITE_CONCURRENCY_LIMIT,
          async (recipient) => {
            const logId = logIdsByEmail.get(recipient.email)
            if (!logId) return
            await teamEmailDispatchLogger.markTeamEmailLogFailed(
              logId,
              failureReasonByEmail.get(recipient.email) ?? "Falha no envio via Resend"
            )
          }
        )

        const failureDetail = this.buildDispatchFailureDetail(dispatchResult.providerErrors, dispatchResult.abortedReason)
        const terminal = resolveCampaignStatusAfterDispatch(dispatchResult.sent, failureDetail)
        const totalFailed = job.recipients.length - dispatchResult.sent

        // lock order: campaign then dispatch (must match EmailLogRepository.applyWebhookEvent)
        const updatedCampaign = await this.commitDispatchTerminalState({
          campaignId: job.campaignId,
          dispatchId: job.dispatchId,
          totalRecipients: job.totalRecipients,
          sentCount: dispatchResult.sent,
          terminal,
          incrementSent: true,
        })

        if (updatedCampaign.parentCampaignId) {
          await this.refreshParentCampaignStatus(updatedCampaign.parentCampaignId).catch((refreshError) => {
            console.error("[EmailCampaignUseCase][completeManualDispatch][refreshParent]", refreshError)
          })
        }

        if (terminal.campaignStatus === "failed") {
          const [campaignMeta, dispatchMeta] = await Promise.all([
            this.db.emailCampaign.findUnique({
              where: { id: job.campaignId },
              select: { name: true },
            }),
            this.db.emailCampaignDispatch.findUnique({
              where: { id: job.dispatchId },
              select: { triggeredBy: true },
            }),
          ])

          await this.notifyDispatchFailureIfNeeded({
            recipientProfileId: dispatchMeta?.triggeredBy,
            teamId: job.teamId,
            campaignId: job.campaignId,
            campaignName: campaignMeta?.name ?? "Campanha",
            dispatchId: job.dispatchId,
            errorMessage: terminal.errorMessage,
          })

          return new Output(
            false,
            [],
            [terminal.errorMessage ?? EMAIL_CAMPAIGN_FAILURE_MESSAGES.RESEND_ZERO],
            {
              sent: dispatchResult.sent,
              failed: totalFailed,
              total: job.recipients.length,
              dispatchId: job.dispatchId,
              dispatchNumber: job.dispatchNumber,
            }
          )
        }

        return new Output(
          true,
          [`Campanha disparada para ${job.recipients.length} destinatário(s)`],
          totalFailed > 0 ? [`${totalFailed} e-mails falharam`] : [],
          {
            sent: dispatchResult.sent,
            failed: totalFailed,
            total: job.recipients.length,
            dispatchId: job.dispatchId,
            dispatchNumber: job.dispatchNumber,
          }
        )
      } finally {
        await this.releaseUnusedTeamCredits(
          job.teamId,
          job.reservedCredits,
          sentCount,
          job.hasCampaignsBetaAccess
        )
      }
    } catch (error) {
      console.error("[EmailCampaignUseCase][completeManualDispatch]", error)

      const reconciled = await this.reconcileManualDispatchAfterError(job).catch((reconcileError) => {
        console.error("[EmailCampaignUseCase][completeManualDispatch][reconcile]", reconcileError)
        return null
      })

      if (reconciled) {
        return reconciled
      }

      const failureMessage = this.resolveDispatchFailureMessage(
        error,
        EMAIL_CAMPAIGN_FAILURE_MESSAGES.INTERNAL
      )

      const sentBeforeGenericFail = await countSuccessfulDispatchLogs(job.dispatchId).catch(
        () => 0
      )

      await this.db.emailCampaignDispatch
        .update({
          where: { id: job.dispatchId },
          data: {
            status: "failed",
            errorMessage: failureMessage,
            ...(sentBeforeGenericFail > 0 ? { totalSent: sentBeforeGenericFail } : {}),
          },
        })
        .catch(() => null)

      const failedCampaign = await this.db.emailCampaign
        .update({
          where: { id: job.campaignId },
          data: {
            status: "failed",
            errorMessage: failureMessage,
          },
          select: { name: true },
        })
        .catch(() => null)

      const dispatchMeta = await this.db.emailCampaignDispatch
        .findUnique({
          where: { id: job.dispatchId },
          select: { triggeredBy: true },
        })
        .catch(() => null)

      await this.notifyDispatchFailureIfNeeded({
        recipientProfileId: dispatchMeta?.triggeredBy,
        teamId: job.teamId,
        campaignId: job.campaignId,
        campaignName: failedCampaign?.name ?? "Campanha",
        dispatchId: job.dispatchId,
        errorMessage: failureMessage,
      })

      await this.refreshParentCampaignStatusForChild(job.campaignId).catch(() => null)

      return new Output(false, [], [failureMessage], null)
    }
  }

  /**
   * Persists terminal campaign + dispatch state.
   * Lock order MUST be campaign then dispatch (same as EmailLogRepository.applyWebhookEvent).
   */
  private async commitDispatchTerminalState(params: {
    campaignId: string
    dispatchId: string
    totalRecipients?: number
    sentCount: number
    terminal: ReturnType<typeof resolveCampaignStatusAfterDispatch>
    incrementSent: boolean
    setDispatchTotalSent?: boolean
    setSentAt?: Date
    incrementDispatchCount?: boolean
  }): Promise<{ parentCampaignId: string | null }> {
    const incrementDispatchCount = params.incrementDispatchCount ?? true
    const setDispatchTotalSent = params.setDispatchTotalSent ?? false

    return withDispatchTerminalCommitRetry(
      async () => {
        const dispatch = await this.db.emailCampaignDispatch.findUnique({
          where: { id: params.dispatchId },
          select: { status: true },
        })
        if (dispatch && dispatch.status !== "sending") {
          const campaign = await this.db.emailCampaign.findUnique({
            where: { id: params.campaignId },
            select: { parentCampaignId: true },
          })
          if (!campaign) {
            throw new Error(
              `[EmailCampaignUseCase][commitDispatchTerminalState] campaign not found: ${params.campaignId}`
            )
          }
          return campaign
        }

        const [updatedCampaign] = await this.db.$transaction([
          this.db.emailCampaign.update({
            where: { id: params.campaignId },
            data: {
              status: params.terminal.campaignStatus,
              sentAt:
                params.setSentAt ??
                (params.terminal.campaignStatus === "sent" ? new Date() : undefined),
              errorMessage: params.terminal.errorMessage,
              ...(params.totalRecipients !== undefined
                ? { totalRecipients: params.totalRecipients }
                : {}),
              ...(params.incrementSent && params.sentCount > 0
                ? { totalSent: { increment: params.sentCount } }
                : {}),
              ...(incrementDispatchCount ? { dispatchCount: { increment: 1 } } : {}),
            },
            select: { parentCampaignId: true },
          }),
          this.db.emailCampaignDispatch.update({
            where: { id: params.dispatchId },
            data: {
              ...(setDispatchTotalSent
                ? { totalSent: params.sentCount }
                : params.incrementSent && params.sentCount > 0
                  ? { totalSent: { increment: params.sentCount } }
                  : {}),
              status: params.terminal.dispatchStatus,
              errorMessage: params.terminal.errorMessage,
            },
          }),
        ])
        return updatedCampaign
      },
      {
        onDeadlockRetry: (attempt, error) => {
          console.error(
            `[EmailCampaignUseCase][commitDispatchTerminalState] deadlock retry attempt=${attempt}`,
            error
          )
        },
        verifyAlreadyCommitted: async () => {
          const dispatch = await this.db.emailCampaignDispatch.findUnique({
            where: { id: params.dispatchId },
            select: { status: true },
          })
          if (dispatch && dispatch.status !== "sending") {
            return this.db.emailCampaign.findUnique({
              where: { id: params.campaignId },
              select: { parentCampaignId: true },
            })
          }
          return null
        },
      }
    )
  }

  private async reconcileManualDispatchAfterError(job: ManualDispatchJob): Promise<Output | null> {
    const stillSending = await this.db.emailCampaignDispatch.findFirst({
      where: { id: job.dispatchId, teamId: job.teamId, status: "sending" },
      select: { id: true },
    })
    if (!stillSending) {
      return new Output(true, ["Disparo já finalizado"], [], {
        campaignId: job.campaignId,
        dispatchId: job.dispatchId,
      })
    }

    const sentCount = await countSuccessfulDispatchLogs(job.dispatchId)
    if (sentCount <= 0) {
      return null
    }

    const terminal = resolveCampaignStatusAfterDispatch(sentCount)

    try {
      const updatedCampaign = await this.commitDispatchTerminalState({
        campaignId: job.campaignId,
        dispatchId: job.dispatchId,
        totalRecipients: job.totalRecipients,
        sentCount,
        terminal,
        incrementSent: true,
      })

      if (updatedCampaign.parentCampaignId) {
        await this.refreshParentCampaignStatus(updatedCampaign.parentCampaignId).catch(() => null)
      }

      console.info("[EmailCampaignUseCase][completeManualDispatch] reconciled after error", {
        campaignId: job.campaignId,
        dispatchId: job.dispatchId,
        sentCount,
      })

      return new Output(
        true,
        [`Campanha reconciliada após falha transitória: ${sentCount} e-mail(s) enviados`],
        [],
        {
          sent: sentCount,
          failed: Math.max(0, job.recipients.length - sentCount),
          total: job.recipients.length,
          dispatchId: job.dispatchId,
          dispatchNumber: job.dispatchNumber,
          reconciled: true,
        }
      )
    } catch (commitError) {
      console.error(
        "[EmailCampaignUseCase][reconcileManualDispatchAfterError][commit]",
        commitError
      )

      await persistDispatchTerminalFallback({
        campaignId: job.campaignId,
        dispatchId: job.dispatchId,
        sentCount,
        terminal,
        totalRecipients: job.totalRecipients,
      })

      const campaignAfterFallback = await this.db.emailCampaign.findUnique({
        where: { id: job.campaignId },
        select: { parentCampaignId: true },
      })
      if (campaignAfterFallback?.parentCampaignId) {
        await this.refreshParentCampaignStatus(campaignAfterFallback.parentCampaignId).catch(
          () => null
        )
      }

      console.info(
        "[EmailCampaignUseCase][completeManualDispatch] reconciled terminal state via fallback",
        {
          campaignId: job.campaignId,
          dispatchId: job.dispatchId,
          sentCount,
        }
      )

      return new Output(
        true,
        [`Campanha reconciliada (estado terminal preservado): ${sentCount} e-mail(s) enviados`],
        [],
        {
          sent: sentCount,
          failed: Math.max(0, job.recipients.length - sentCount),
          total: job.recipients.length,
          dispatchId: job.dispatchId,
          dispatchNumber: job.dispatchNumber,
          reconciled: true,
          usedFallback: true,
        }
      )
    }
  }

  /** Compat: executa start + complete de forma síncrona (testes / callers legados). */
  async send(id: string, ctx: TeamContext, options?: ManualDispatchOptions): Promise<Output> {
    const started = await this.startManualDispatch(id, ctx, options)
    if (!started.isValid || !started.result) {
      return started
    }
    return this.completeManualDispatch(started.result as ManualDispatchJob)
  }

  async recoverStuckSendingCampaigns(now = new Date()): Promise<number> {
    const threshold = new Date(now.getTime() - STUCK_SENDING_THRESHOLD_MS)

    // Primeiro, recuperar campanhas órfãs (em "sending" sem dispatch)
    // Essas devem ser revertidas para o estado anterior, não marcadas como failed
    const orphanCampaigns = await this.db.emailCampaign.findMany({
      where: {
        status: "sending",
        updatedAt: { lt: threshold },
      },
      select: {
        id: true,
        name: true,
        _count: { select: { dispatches: true } },
      },
    })

    const orphanCampaignsWithoutDispatches = orphanCampaigns.filter(
      (c) => c._count.dispatches === 0
    )

    if (orphanCampaignsWithoutDispatches.length > 0) {
      console.error(
        `[EmailCampaignUseCase][recoverStuckSendingCampaigns] ${orphanCampaignsWithoutDispatches.length} campanha(s) órfã(s) detectada(s) (sem dispatch). Revertendo para 'draft'.`,
        orphanCampaignsWithoutDispatches.map((c) => ({ id: c.id, name: c.name }))
      )

      await this.db.emailCampaign.updateMany({
        where: {
          id: { in: orphanCampaignsWithoutDispatches.map((c) => c.id) },
        },
        data: {
          status: "draft",
          errorMessage:
            "Disparo interrompido antes de criar o registro de envio. A campanha foi revertida para rascunho.",
        },
      })
    }

    // Agora marcar como failed apenas campanhas com dispatch travado
    const [campaigns, dispatches] = await this.db.$transaction([
      this.db.emailCampaign.updateMany({
        where: { status: "sending", updatedAt: { lt: threshold } },
        data: {
          status: "failed",
          errorMessage: EMAIL_CAMPAIGN_FAILURE_MESSAGES.STUCK_SENDING,
        },
      }),
      this.db.emailCampaignDispatch.updateMany({
        where: { status: "sending", updatedAt: { lt: threshold } },
        data: {
          status: "failed",
          errorMessage: EMAIL_CAMPAIGN_FAILURE_MESSAGES.STUCK_SENDING,
        },
      }),
    ])

    if (campaigns.count > 0 || orphanCampaignsWithoutDispatches.length > 0) {
      console.error(
        `[EmailCampaignUseCase][recoverStuckSendingCampaigns] Recovery concluído: ${orphanCampaignsWithoutDispatches.length} órfã(s) revertida(s), ${campaigns.count} campanha(s) marcada(s) como failed (timeout 30 min); ${dispatches.count} dispatch(es) atualizado(s)`
      )
    }

    return campaigns.count + orphanCampaignsWithoutDispatches.length
  }

  /**
   * Retoma dispatches manuais órfãos (ex.: after() cortado) que ainda têm logs queued
   * e não atingiram o timeout de stuck.
   */
  async resumeOrphanSendingDispatches(options?: {
    maxDispatches?: number
    now?: Date
  }): Promise<number> {
    const now = options?.now ?? new Date()
    const maxDispatches = options?.maxDispatches ?? DEFAULT_ORPHAN_RESUME_BATCH_SIZE
    const stuckThreshold = new Date(now.getTime() - STUCK_SENDING_THRESHOLD_MS)
    const minAge = new Date(now.getTime() - ORPHAN_RESUME_MIN_AGE_MS)

    const orphanDispatches = await this.db.emailCampaignDispatch.findMany({
      where: {
        status: "sending",
        updatedAt: { lt: minAge, gte: stuckThreshold },
        campaign: { status: "sending" },
      },
      select: {
        id: true,
        campaignId: true,
        teamId: true,
        dispatchNumber: true,
        batchIdempotencyScheme: true,
        templateHtml: true,
        templateSubject: true,
        totalRecipients: true,
        triggeredBy: true,
        contactListId: true,
        radarSegmentSlug: true,
        templateId: true,
      },
      orderBy: { updatedAt: "asc" },
      take: maxDispatches,
    })

    let resumed = 0
    for (const dispatch of orphanDispatches) {
      try {
        const queuedLogs = await this.db.emailLog.findMany({
          where: { dispatchId: dispatch.id, status: "queued" },
          select: {
            id: true,
            recipientEmail: true,
            recipientName: true,
          },
        })

        if (queuedLogs.length === 0) {
          const sentCount = await countSuccessfulDispatchLogs(dispatch.id)
          const terminal = resolveCampaignStatusAfterDispatch(sentCount)
          // lock order: campaign then dispatch (must match EmailLogRepository.applyWebhookEvent)
          const updatedCampaign = await this.commitDispatchTerminalState({
            campaignId: dispatch.campaignId,
            dispatchId: dispatch.id,
            totalRecipients: dispatch.totalRecipients,
            sentCount,
            terminal,
            incrementSent: true,
            setDispatchTotalSent: true,
            setSentAt: terminal.campaignStatus === "sent" ? now : undefined,
            incrementDispatchCount: true,
          })
          if (updatedCampaign.parentCampaignId) {
            await this.refreshParentCampaignStatus(updatedCampaign.parentCampaignId).catch(
              (refreshError) => {
                console.error(
                  "[EmailCampaignUseCase][resumeOrphanSendingDispatches][refreshParent]",
                  refreshError
                )
              }
            )
          }
          resumed += 1
          continue
        }

        let teamSettings = null
        try {
          teamSettings = await this.db.emailTeamSettings.findUnique({
            where: { teamId: dispatch.teamId },
          })
        } catch {
          teamSettings = null
        }

        const defaultSender = await this.db.emailTeamSender
          .findFirst({
            where: { teamId: dispatch.teamId, isDefault: true },
            select: { name: true, email: true },
          })
          .catch(() => null)

        const fromResolved = resolveCampaignFrom({
          domainName: teamSettings?.resendDomainName,
          legacyFromName: teamSettings?.fromName,
          legacyFromEmail: teamSettings?.fromEmail,
          defaultSender,
        })

        const orphanFromGuard = assertCampaignFromIsSendable({
          resolved: fromResolved,
          domainName: teamSettings?.resendDomainName,
          domainStatus: teamSettings?.resendDomainStatus,
        })
        if (!orphanFromGuard.ok) {
          console.error(
            `[EmailCampaignUseCase][resumeOrphanSendingDispatches] dispatchId=${dispatch.id} bloqueado por domínio: ${orphanFromGuard.message}`
          )
          await this.markScheduledCampaignFailed(dispatch.campaignId, orphanFromGuard.message)
          await this.db.emailCampaignDispatch.update({
            where: { id: dispatch.id },
            data: { status: "failed", errorMessage: orphanFromGuard.message },
          })
          continue
        }

        const globalDefaults = await this.recipientService.getGlobalDefaults(dispatch.teamId)

        const recipients = await this.rebuildRecipientsForOrphanResume({
          teamId: dispatch.teamId,
          contactListId: dispatch.contactListId,
          queuedLogs,
        })

        const publishedTemplate = await this.resolvePublishedTemplate(
          dispatch.templateId,
          dispatch.teamId
        )
        const templateVariables = this.recipientService.parseTemplateVariables(
          publishedTemplate?.variables ?? []
        )

        const job: ManualDispatchJob = {
          campaignId: dispatch.campaignId,
          dispatchId: dispatch.id,
          dispatchNumber: dispatch.dispatchNumber,
          teamId: dispatch.teamId,
          previousStatus: "sent",
          reservedCredits: 0,
          hasCampaignsBetaAccess: true,
          recipients,
          subject: dispatch.templateSubject,
          html: dispatch.templateHtml,
          from: formatCampaignFromHeader(fromResolved),
          replyTo: teamSettings?.replyTo ?? null,
          globalDefaults,
          templateVariables,
          logIdsByEmail: queuedLogs.map((log) => ({
            email: log.recipientEmail,
            logId: log.id,
          })),
          totalRecipients: dispatch.totalRecipients,
          retryFailedOnly: false,
          status: "sending",
          batchIdempotencyScheme: dispatch.batchIdempotencyScheme,
          enableContentHashFallbackOnIdempotencyConflict:
            dispatch.batchIdempotencyScheme === "positional",
        }

        console.info("[EmailCampaignUseCase][resumeOrphanSendingDispatches] retomando", {
          dispatchId: dispatch.id,
          queued: queuedLogs.length,
        })
        await this.completeManualDispatch(job)
        resumed += 1
      } catch (error) {
        console.error("[EmailCampaignUseCase][resumeOrphanSendingDispatches]", {
          dispatchId: dispatch.id,
          error,
        })
      }
    }

    return resumed
  }

  /**
   * Recarrega contactId/customFields (e enriquecimento Radar) para retomar disparos órfãos
   * a partir dos logs queued — os logs não persistem personalização.
   */
  private async rebuildRecipientsForOrphanResume(params: {
    teamId: string
    contactListId: string | null
    queuedLogs: Array<{ recipientEmail: string; recipientName: string | null }>
  }): Promise<CampaignRecipient[]> {
    const emails = params.queuedLogs.map((log) => log.recipientEmail.trim().toLowerCase())
    const uniqueEmails = Array.from(new Set(emails))

    const contacts = await this.db.emailContact.findMany({
      where: {
        email: { in: uniqueEmails, mode: "insensitive" },
        ...(params.contactListId
          ? { listId: params.contactListId }
          : {
              list: {
                teamId: params.teamId,
                isArchived: false,
              },
            }),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        customFields: true,
      },
    })

    const contactByEmail = new Map<
      string,
      { id: string; name: string | null; customFields: Record<string, unknown> | null }
    >()
    for (const contact of contacts) {
      const key = contact.email.trim().toLowerCase()
      if (!contactByEmail.has(key)) {
        contactByEmail.set(key, {
          id: contact.id,
          name: contact.name,
          customFields: contact.customFields as Record<string, unknown> | null,
        })
      }
    }

    const baseRecipients: CampaignRecipient[] = params.queuedLogs.map((log) => {
      const key = log.recipientEmail.trim().toLowerCase()
      const contact = contactByEmail.get(key)
      return {
        email: key,
        name: contact?.name ?? log.recipientName,
        contactId: contact?.id ?? null,
        customFields: contact?.customFields ?? null,
      }
    })

    const enriched = await enrichCampaignRecipientsWithRadar(params.teamId, baseRecipients)
    return enriched.map((recipient) => ({
      email: recipient.email,
      name: recipient.name ?? null,
      contactId: recipient.contactId ?? null,
      customFields: recipient.customFields ?? null,
    }))
  }

  private async markScheduledCampaignFailed(campaignId: string, errorMessage: string): Promise<void> {
    console.error(`[EmailCampaignUseCase][dispatchScheduled] campaignId=${campaignId} motivo=${errorMessage}`)
    const updated = await this.db.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "failed", errorMessage },
      select: { parentCampaignId: true, name: true, teamId: true, createdBy: true },
    })
    if (updated.createdBy) {
      await this.notifyDispatchFailureIfNeeded({
        recipientProfileId: updated.createdBy,
        teamId: updated.teamId,
        campaignId,
        campaignName: updated.name,
        errorMessage,
      })
    }
    if (updated.parentCampaignId) {
      await this.refreshParentCampaignStatus(updated.parentCampaignId)
    }
  }

  async dispatchScheduledCampaigns(options?: { maxCampaigns?: number; now?: Date }): Promise<Output> {
    const now = options?.now ?? new Date()
    const maxCampaigns = options?.maxCampaigns ?? DEFAULT_SCHEDULED_BATCH_SIZE

    await this.recoverStuckSendingCampaigns(now)

    const campaigns = await this.db.emailCampaign.findMany({
      where: {
        status: "scheduled",
        scheduledAt: { lte: now },
        subCampaigns: { none: {} },
      },
      include: {
        template: true,
        contactList: { select: { id: true, name: true } },
        team: { select: { master: { select: { id: true, timezone: true } } } },
      },
      take: maxCampaigns,
    })

    let dispatched = 0

    for (const campaign of campaigns) {
      try {
        const lockResult = await this.db.emailCampaign.updateMany({
          where: { id: campaign.id, status: "scheduled" },
          data: { status: "sending" },
        })

        if (lockResult.count === 0) {
          continue
        }

        const masterId = campaign.team.master.id
        const ownerTz = resolveTimezone(campaign.team.master.timezone)

        const teamSettings = await this.db.emailTeamSettings
          .findUnique({
            where: { teamId: campaign.teamId },
            select: {
              dispatchBlockedDates: true,
              dispatchTimeFrom: true,
              dispatchTimeTo: true,
              fromName: true,
              fromEmail: true,
              replyTo: true,
              resendDomainName: true,
              resendDomainStatus: true,
            },
          })
          .catch(() => null)

        const scheduledDispatchWarnings = getResendDomainDispatchWarnings(
          teamSettings?.resendDomainStatus
        )
        // Cron has no HTTP consumer — tracking warnings are observability-only (see EMAIL_SPEC D12).
        if (scheduledDispatchWarnings.length > 0) {
          console.info(
            `[EmailCampaignUseCase][dispatchScheduled] campaignId=${campaign.id} aviso: ${scheduledDispatchWarnings.join(" ")}`
          )
        }

        if (teamSettings) {
          const windowCheck = checkDispatchWindow(now, ownerTz, {
            dispatchBlockedDates: teamSettings.dispatchBlockedDates as DispatchBlockedDateEntry[] | null,
            dispatchTimeFrom: teamSettings.dispatchTimeFrom,
            dispatchTimeTo: teamSettings.dispatchTimeTo,
          })
          if (windowCheck.blocked && windowCheck.defer) {
            await this.db.emailCampaign.update({
              where: { id: campaign.id },
              data: { status: "scheduled" },
            })
            console.info(
              `[EmailCampaignUseCase][dispatchScheduled] campaignId=${campaign.id} adiada: ${windowCheck.reason}`
            )
            continue
          }
        }

        const publishedTemplate = campaign.template
        if (!publishedTemplate.html) {
          await this.markScheduledCampaignFailed(campaign.id, EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_HTML)
          continue
        }

        const radarBetaAccess = await featureAccessService.resolveRadarBetaAccess({
          profileId: masterId,
          managerId: masterId,
          isMaster: true,
          teamId: campaign.teamId,
        })
        if (!radarBetaAccess) {
          await this.markScheduledCampaignFailed(
            campaign.id,
            EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RADAR_BETA
          )
          continue
        }

        const hasCampaignsBetaAccess = await featureAccessService.resolveEmailBetaAccess({
          profileId: masterId,
          managerId: masterId,
          isMaster: true,
          teamId: campaign.teamId,
        })

        const templateHtml = inlineEmailHtml(publishedTemplate.html)

        const defaultSender = await this.db.emailTeamSender
          .findFirst({
            where: { teamId: campaign.teamId, isDefault: true },
            select: { name: true, email: true },
          })
          .catch(() => null)

        const dispatchInput = await this.recipientService.buildCampaignDispatchInput({
          teamId: campaign.teamId,
          contactListId: campaign.contactListId,
          radarSegmentSlug: campaign.radarSegmentSlug,
          audienceContactIds: campaign.audienceContactIds,
          template: {
            subject: publishedTemplate.subject,
            html: templateHtml,
            variables: publishedTemplate.variables,
          },
          teamSettings,
          defaultSender,
          masterTimezone: campaign.team.master.timezone,
        })

        const scheduledFromGuard = assertCampaignFromIsSendable({
          resolved: dispatchInput.resolvedFrom,
          domainName: teamSettings?.resendDomainName,
          domainStatus: teamSettings?.resendDomainStatus,
        })
        if (!scheduledFromGuard.ok) {
          await this.markScheduledCampaignFailed(campaign.id, scheduledFromGuard.message)
          continue
        }

        if (dispatchInput.recipients.length === 0) {
          const noRecipientsMessage = campaign.radarSegmentSlug
            ? EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_RADAR
            : EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_LIST
          await this.markScheduledCampaignFailed(campaign.id, noRecipientsMessage)
          continue
        }

        const dailyCap = await wouldExceedDailyEmailCap({
          teamId: campaign.teamId,
          timezone: ownerTz,
          now,
          additionalRecipients: dispatchInput.recipients.length,
        })
        if (dailyCap.exceeded) {
          await this.db.emailCampaign.update({
            where: { id: campaign.id },
            data: { status: "scheduled" },
          })
          console.info(
            `[EmailCampaignUseCase][dispatchScheduled] campaignId=${campaign.id} adiada: limite diário ${dailyCap.used}/${dailyCap.limit}`
          )
          continue
        }

        const unresolvedTokens = this.recipientService.findUnresolvedTokensForRecipients({
          subject: dispatchInput.subject,
          html: dispatchInput.html,
          recipients: dispatchInput.recipients,
          globalDefaults: dispatchInput.globalDefaults,
          templateVariables: dispatchInput.templateVariables,
        })

        if (unresolvedTokens.length > 0) {
          await this.markScheduledCampaignFailed(
            campaign.id,
            `Variáveis sem valor suficiente: ${unresolvedTokens.map((token) => `{{${token}}}`).join(", ")}`
          )
          continue
        }

        const dispatchNumber = await this.getNextDispatchNumber(campaign.id)
        const reservedCredits = dispatchInput.recipients.length

        const creditReservation = await this.reserveTeamCreditsForDispatch(
          campaign.teamId,
          reservedCredits,
          hasCampaignsBetaAccess
        )
        if (!creditReservation.ok) {
          await this.db.emailCampaign.update({
            where: { id: campaign.id },
            data: { status: "scheduled", errorMessage: creditReservation.message },
          })
          console.error(
            `[EmailCampaignUseCase][dispatchScheduled] campaignId=${campaign.id} motivo=${creditReservation.message}`
          )
          continue
        }

        let sentCount = 0
        try {
        const dispatchRecord = await this.db.emailCampaignDispatch.create({
          data: {
            id: randomUUID(),
            campaignId: campaign.id,
            teamId: campaign.teamId,
            dispatchNumber,
            templateId: publishedTemplate.id,
            templateVersionNumber: publishedTemplate.versionNumber,
            templateName: publishedTemplate.name,
            templateSubject: publishedTemplate.subject,
            templateHtml,
            contactListId: campaign.contactListId,
            contactListName: campaign.contactList?.name ?? null,
            radarSegmentSlug: campaign.radarSegmentSlug,
            triggeredBy: campaign.createdBy,
            totalRecipients: dispatchInput.recipients.length,
            status: "sending",
            batchIdempotencyScheme: "contentHash",
            retryFailedOnly: false,
          },
        })

        const recipientsList = dispatchInput.recipients
        const { valid: validRecipients, invalid: invalidRecipients } =
          this.partitionRecipientsByEmailValidity(recipientsList)

        const logInputs = recipientsList.map((recipient) => ({
          teamId: campaign.teamId,
          campaignId: campaign.id,
          dispatchId: dispatchRecord.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          subject: interpolateEmailTemplate(
            dispatchInput.subject,
            recipient,
            dispatchInput.globalDefaults,
            dispatchInput.templateVariables
          ),
          category: "campaign" as const,
          sourceType: "campaign",
          sourceId: campaign.id,
        }))
        const createdLogs = await teamEmailDispatchLogger.createQueuedTeamEmailLogs(logInputs)
        const logIdsByEmail = new Map(createdLogs.map(({ email, logId }) => [email, logId]))

        const dispatchResult =
          validRecipients.length > 0
            ? await this.dispatchService.dispatchBatch({
                from: dispatchInput.from,
                replyTo: dispatchInput.replyTo,
                recipients: validRecipients,
                subject: dispatchInput.subject,
                html: dispatchInput.html,
                campaignId: campaign.id,
                teamId: campaign.teamId,
                dispatchId: dispatchRecord.id,
                dispatchNumber,
                batchIdempotencyScheme: "contentHash",
                globalDefaults: dispatchInput.globalDefaults,
                templateVariables: dispatchInput.templateVariables,
                logIdByEmail: logIdsByEmail,
                onChunkDispatched: async (chunkDispatched) => {
                  const sentEntries = chunkDispatched.flatMap(({ email, resendId }) => {
                    const logId = logIdsByEmail.get(email)
                    return logId ? [{ logId, resendEmailId: resendId }] : []
                  })
                  if (sentEntries.length > 0) {
                    await teamEmailDispatchLogger.markManyTeamEmailLogsSent(sentEntries)
                  }
                },
              })
            : {
                sent: 0,
                failed: invalidRecipients.length,
                dispatched: [] as Array<{ email: string; resendId: string }>,
                providerErrors: invalidRecipients.map((recipient) => ({
                  message: formatInvalidRecipientFailureMessage(
                    recipient.email,
                    recipient.reason
                  ),
                  emails: [recipient.email],
                })),
                abortedReason: undefined as "domain_not_verified" | undefined,
              }

        sentCount = dispatchResult.sent

        const failureReasonByEmail = this.buildFailureReasonByEmail(dispatchResult.providerErrors)
        for (const recipient of invalidRecipients) {
          if (!failureReasonByEmail.has(recipient.email)) {
            failureReasonByEmail.set(
              recipient.email,
              formatInvalidRecipientFailureMessage(recipient.email, recipient.reason)
            )
          }
        }

        const dispatchedEmails = new Set(dispatchResult.dispatched.map((entry) => entry.email))
        this.recordDispatchLeadActivities({
          teamId: campaign.teamId,
          campaignId: campaign.id,
          dispatchId: dispatchRecord.id,
          recipients: recipientsList,
          dispatchedEmails,
          subject: dispatchInput.subject,
          globalDefaults: dispatchInput.globalDefaults,
          templateVariables: dispatchInput.templateVariables,
        })
        await withConcurrencyLimit(
          recipientsList.filter((recipient) => !dispatchedEmails.has(recipient.email)),
          EMAIL_LOG_WRITE_CONCURRENCY_LIMIT,
          async (recipient) => {
            const logId = logIdsByEmail.get(recipient.email)
            if (!logId) return
            await teamEmailDispatchLogger.markTeamEmailLogFailed(
              logId,
              failureReasonByEmail.get(recipient.email) ?? "Falha no envio via Resend"
            )
          }
        )

        const failureDetail = this.buildDispatchFailureDetail(dispatchResult.providerErrors, dispatchResult.abortedReason)
        const terminal = resolveCampaignStatusAfterDispatch(dispatchResult.sent, failureDetail)

        // lock order: campaign then dispatch (must match EmailLogRepository.applyWebhookEvent)
        await this.commitDispatchTerminalState({
          campaignId: campaign.id,
          dispatchId: dispatchRecord.id,
          totalRecipients: recipientsList.length,
          sentCount: dispatchResult.sent,
          terminal,
          incrementSent: true,
          setDispatchTotalSent: true,
        })

        if (terminal.campaignStatus === "sent") {
          dispatched++
          const scheduledLabel = campaign.scheduledAt
            ? formatIntimezone(campaign.scheduledAt, "dd/MM/yyyy HH:mm", ownerTz)
            : "sem data"
          console.info(
            `[EmailCampaignUseCase][dispatchScheduled] campaignId=${campaign.id} disparada: ${dispatchResult.sent} e-mails (agendada ${scheduledLabel} ${ownerTz})`
          )
        } else {
          console.error(
            `[EmailCampaignUseCase][dispatchScheduled] campaignId=${campaign.id} motivo=${terminal.errorMessage ?? EMAIL_CAMPAIGN_FAILURE_MESSAGES.RESEND_ZERO}`
          )
        }

        if (campaign.parentCampaignId) {
          await this.refreshParentCampaignStatus(campaign.parentCampaignId)
        }
        } finally {
          await this.releaseUnusedTeamCredits(
            campaign.teamId,
            reservedCredits,
            sentCount,
            hasCampaignsBetaAccess
          )
        }
      } catch (campaignError) {
        console.error(`[EmailCampaignUseCase][dispatchScheduled] campaignId=${campaign.id}`, campaignError)
        const failureMessage = this.resolveDispatchFailureMessage(
          campaignError,
          EMAIL_CAMPAIGN_FAILURE_MESSAGES.INTERNAL
        )
        await this.markScheduledCampaignFailed(campaign.id, failureMessage)
        if (campaign.parentCampaignId) {
          await this.refreshParentCampaignStatus(campaign.parentCampaignId)
        }
      }
    }

    console.info(`[EmailCampaignUseCase][dispatchScheduled] ${dispatched} campanha(s) disparada(s) nesta execução`)

    const orphanResult = await emailOrphanEventService.processPendingBatch().catch((error) => {
      console.error("[EmailCampaignUseCase][dispatchScheduled][orphanEvents]", error)
      return { processed: 0, failed: 0, skipped: 0 }
    })
    if (orphanResult.processed > 0 || orphanResult.failed > 0) {
      console.info(
        `[EmailCampaignUseCase][dispatchScheduled] órfãos: ${orphanResult.processed} processados, ${orphanResult.failed} falharam`
      )
    }

    return new Output(true, [`${dispatched} campanhas disparadas`], [], { dispatched, orphanResult })
  }

  private async hasSiblingDailyCapConflict(params: {
    teamId: string
    parentCampaignId: string
    campaignId: string
    scheduledAt: Date
    totalRecipients: number
  }): Promise<boolean> {
    const limits = await resolveTeamEmailCampaignLimits(params.teamId)
    if (limits.maxRecipientsPerSub == null) return false

    const team = await this.db.team.findFirst({
      where: { id: params.teamId },
      select: { master: { select: { timezone: true } } },
    })
    const timezone = resolveTimezone(team?.master.timezone)
    const dayKey = formatLocalDateValue(params.scheduledAt, timezone)

    const siblings = await this.db.emailCampaign.findMany({
      where: {
        parentCampaignId: params.parentCampaignId,
        teamId: params.teamId,
        id: { not: params.campaignId },
        status: { in: ["draft", "scheduled", "sending", "sent"] },
        scheduledAt: { not: null },
      },
      select: { scheduledAt: true, totalRecipients: true },
    })

    let dayTotal = params.totalRecipients
    for (const sibling of siblings) {
      if (!sibling.scheduledAt) continue
      if (formatLocalDateValue(sibling.scheduledAt, timezone) !== dayKey) continue
      dayTotal += sibling.totalRecipients
    }

    return dayTotal > limits.maxRecipientsPerSub
  }

  private async refreshParentCampaignStatus(
    parentCampaignId: string
  ): Promise<{ status: EmailCampaignStatus; totalSent: number; dispatchCount: number } | null> {
    const children = await this.db.emailCampaign.findMany({
      where: { parentCampaignId },
      select: { status: true, totalSent: true, totalDelivered: true, totalOpened: true, totalClicked: true, totalBounced: true, dispatchCount: true, sentAt: true },
    })
    if (children.length === 0) return null

    const statuses = new Set(children.map((child) => child.status))
    let parentStatus: EmailCampaignStatus = "scheduled"
    if (statuses.has("sending")) {
      parentStatus = "sending"
    } else if (statuses.has("scheduled") || statuses.has("draft")) {
      parentStatus = "scheduled"
    } else if ([...statuses].every((status) => status === "canceled")) {
      parentStatus = "canceled"
    } else if (statuses.has("failed") && !statuses.has("sent") && !statuses.has("partially_sent")) {
      parentStatus = "failed"
    } else if (statuses.has("failed") && (statuses.has("sent") || statuses.has("partially_sent"))) {
      parentStatus = "partially_sent"
    } else if (statuses.has("sent") || statuses.has("partially_sent") || statuses.has("canceled")) {
      parentStatus = "sent"
    }

    const totals = children.reduce(
      (acc, child) => ({
        totalSent: acc.totalSent + child.totalSent,
        totalDelivered: acc.totalDelivered + child.totalDelivered,
        totalOpened: acc.totalOpened + child.totalOpened,
        totalClicked: acc.totalClicked + child.totalClicked,
        totalBounced: acc.totalBounced + child.totalBounced,
        dispatchCount: acc.dispatchCount + child.dispatchCount,
      }),
      {
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        dispatchCount: 0,
      }
    )

    const lastSentAt = children
      .map((child) => child.sentAt)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0]

    await this.db.emailCampaign.update({
      where: { id: parentCampaignId },
      data: {
        status: parentStatus,
        ...totals,
        ...(parentStatus === "sent" && lastSentAt ? { sentAt: lastSentAt } : {}),
      },
    })

    return { status: parentStatus, totalSent: totals.totalSent, dispatchCount: totals.dispatchCount }
  }

  async cancel(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await this.db.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: ["scheduled", "sending"] } },
        select: {
          id: true,
          status: true,
          parentCampaignId: true,
          _count: { select: { subCampaigns: true } },
        },
      })

      if (!existing) {
        return new Output(false, [], ["Campanha não encontrada ou não pode ser cancelada"], null)
      }

      if (existing.status === "scheduled") {
        if (existing._count.subCampaigns > 0) {
          await this.db.$transaction([
            this.db.emailCampaign.updateMany({
              where: {
                parentCampaignId: id,
                teamId: ctx.teamId,
                status: "scheduled",
              },
              data: { status: "canceled" },
            }),
            this.db.emailCampaign.update({
              where: { id },
              data: { status: "canceled" },
            }),
          ])
        } else {
          await this.db.emailCampaign.update({
            where: { id },
            data: { status: "canceled" },
          })
          if (existing.parentCampaignId) {
            await this.refreshParentCampaignStatus(existing.parentCampaignId)
          }
        }

        return new Output(true, ["Campanha cancelada com sucesso"], [], null)
      }

      // Status: "sending" - cancelar logs pendentes e dispatches em andamento
      const result = await this.db.$transaction(async (tx) => {
        // 1. Cancelar logs pendentes (queued)
        const canceledLogs = await tx.emailLog.updateMany({
          where: {
            campaignId: id,
            teamId: ctx.teamId,
            status: "queued",
          },
          data: {
            status: "failed",
          },
        })

        // 2. Marcar dispatches incompletos como failed
        await tx.emailCampaignDispatch.updateMany({
          where: {
            campaignId: id,
            teamId: ctx.teamId,
            status: "sending",
          },
          data: {
            status: "failed",
            errorMessage: "Cancelado pelo usuário",
          },
        })

        // 3. Contar logs para determinar status final da campanha
        const logStats = await tx.emailLog.groupBy({
          by: ["status"],
          where: {
            campaignId: id,
            teamId: ctx.teamId,
          },
          _count: true,
        })

        const sentCount = logStats.find((s) => s.status === "sent")?._count ?? 0
        const deliveredCount = logStats.find((s) => s.status === "delivered")?._count ?? 0
        const totalSent = sentCount + deliveredCount

        // 4. Atualizar status da campanha
        let newStatus: "canceled" | "partially_sent"
        if (totalSent === 0) {
          newStatus = "canceled"
        } else {
          newStatus = "partially_sent"
        }

        await tx.emailCampaign.update({
          where: { id },
          data: { status: newStatus },
        })

        return {
          canceledCount: canceledLogs.count,
          sentCount: totalSent,
          newStatus,
        }
      })

      const message =
        result.canceledCount > 0
          ? `${result.canceledCount} e-mail(s) cancelado(s). ${result.sentCount} já haviam sido enviados.`
          : result.sentCount > 0
            ? "Todos os e-mails já foram enviados. Nenhum e-mail pendente para cancelar."
            : "Campanha cancelada."

      return new Output(true, [message], [], {
        canceledCount: result.canceledCount,
        sentCount: result.sentCount,
        status: result.newStatus,
      })
    } catch (error) {
      console.error("[EmailCampaignUseCase][cancel]", error)
      return new Output(false, [], ["Erro ao cancelar campanha"], null)
    }
  }

  async deleteDraft(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await this.db.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: ["draft", "scheduled", "canceled"] } },
      })

      if (!existing) {
        return new Output(false, [], ["Campanha não encontrada ou não pode ser excluída"], null)
      }

      await this.db.emailCampaign.delete({ where: { id } })

      return new Output(true, ["Campanha removida com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailCampaignUseCase][deleteDraft]", error)
      return new Output(false, [], ["Erro ao remover campanha"], null)
    }
  }

  async archive(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await this.db.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: ["sent", "failed", "partially_sent"] } },
      })

      if (!existing) {
        return new Output(false, [], ["Campanha não encontrada ou não pode ser arquivada"], null)
      }

      await this.db.emailCampaign.update({
        where: { id },
        data: { status: "archived" },
      })

      return new Output(true, ["Campanha arquivada com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailCampaignUseCase][archive]", error)
      return new Output(false, [], ["Erro ao arquivar campanha"], null)
    }
  }
}
