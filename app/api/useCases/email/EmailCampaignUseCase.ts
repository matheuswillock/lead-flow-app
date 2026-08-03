import { randomUUID } from "crypto"
import type { EmailCampaignStatus } from "@prisma/client"
import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
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
import { featureAccessRepository } from "@/app/api/infra/data/repositories/featureAccess/FeatureAccessRepository"
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
  resolveCampaignStatusAfterDispatch,
  type DispatchBlockedDateEntry,
} from "@/lib/email/campaign-dispatch-guards"
import { withDeadlockRetry } from "@/lib/email/with-deadlock-retry"
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
import { toFriendlyDispatchErrorMessage, isAlreadyFriendlyMessage } from "@/lib/email/campaign-error-messages"
import { resolveTeamEmailCampaignLimits } from "@/lib/email/resolve-team-email-campaign-limits"
import {
  requiresSubCampaignSplit,
} from "@/lib/email/campaign-sub-campaigns"
import {
  buildCampaignPlan,
  normalizeContactListIds,
  resolveListStrategy,
  validateCampaignPlanSchedules,
  type ListAudienceSlice,
  type ListStrategy,
  type SubCampaignScheduleInput,
} from "@/lib/email/campaign-plan"
import { detectLinkedFormFromTemplateHtml } from "@/lib/email/detect-template-form"

const EMAIL_LOG_WRITE_CONCURRENCY_LIMIT = 2
const STUCK_SENDING_THRESHOLD_MS = 30 * 60 * 1000
const ORPHAN_RESUME_MIN_AGE_MS = 2 * 60 * 1000
const DEFAULT_SCHEDULED_BATCH_SIZE = 5
const DEFAULT_ORPHAN_RESUME_BATCH_SIZE = 3
const MANUAL_DISPATCH_STATUSES = ["draft", "scheduled", "sent", "failed"] as const
const MANUAL_DISPATCH_STATUS_SET = new Set<EmailCampaignStatus>(MANUAL_DISPATCH_STATUSES)

export const EMAIL_CAMPAIGN_FAILURE_MESSAGES = {
  NO_HTML: "Template sem HTML. Edite o template antes de disparar",
  NO_CREDITS: "Sem assinatura de créditos de e-mail ativa. Ative um plano em Assinaturas",
  NO_RECIPIENTS_LIST: "Nenhum contato ativo na lista para envio",
  NO_RECIPIENTS_RADAR: "Nenhum perfil apto no segmento Radar",
  STUCK_SENDING: "Disparo interrompido: tempo limite de envio excedido (30 min)",
  INTERNAL: "Erro interno durante o disparo",
  RESEND_ZERO: "Nenhum e-mail foi enviado pelo provedor",
  formatDailyLimit: formatDailyLimitFailureMessage,
} as const

export interface CreateCampaignInput {
  name: string
  templateId: string
  contactListId?: string
  contactListIds?: string[]
  listStrategy?: ListStrategy
  radarSegmentSlug?: string
  scheduledAt?: string | null
  scheduleIntervalDays?: number | null
  uniformSchedule?: boolean
  subCampaignSchedules?: SubCampaignScheduleInput[]
}

export type SubCampaignUpdateInput = {
  id: string
  name?: string
  scheduledAt?: string | null
  contactListId?: string
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
  status: "sending"
}

export class EmailCampaignUseCase {
  private dispatchService = new EmailCampaignDispatchService()
  private recipientService = new EmailCampaignRecipientService()
  private creditService = new EmailCreditService()

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

  private async resolvePublishedTemplate(templateId: string, teamId: string) {
    const ref = await prisma.emailTemplate.findFirst({
      where: { id: templateId, teamId, isArchived: false },
      select: { versionGroupId: true },
    })
    if (!ref) return null

    return prisma.emailTemplate.findFirst({
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

    const lists = await prisma.emailContactList.findMany({
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
      if (hasLists && hasRadar) {
        return new Output(false, [], ["Use apenas lista de contatos ou segmento Radar, não ambos"], null)
      }

      if (hasRadar) {
        const totalRecipients = await this.countActiveRecipients(ctx.teamId, {
          radarSegmentSlug: data.radarSegmentSlug,
        })
        if (requiresSubCampaignSplit(totalRecipients)) {
          return new Output(
            false,
            [],
            [
              `Segmentos Radar com mais de ${EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB} destinatários não são suportados. Use uma lista de contatos ou reduza o segmento`,
            ],
            null
          )
        }
        const schedule = this.parseScheduleInput(data)
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
        })
      }

      const listStrategy = resolveListStrategy(data)
      if (contactListIds.length > 1 && data.listStrategy !== "merge" && data.listStrategy !== "per_list") {
        return new Output(false, [], ["Selecione a estratégia de uso das listas (merge ou per_list)"], null)
      }

      const { slices, error } = await this.loadListAudiences(ctx.teamId, contactListIds)
      if (error) return new Output(false, [], [error], null)

      const schedule = this.parseScheduleInput(data)
      const teamLimits = await resolveTeamEmailCampaignLimits(ctx.teamId)
      const plan = buildCampaignPlan({
        campaignName: data.name,
        listStrategy,
        sourceContactListIds: listStrategy === "merge" ? contactListIds : contactListIds,
        listAudiences: slices,
        maxRecipientsPerSub: teamLimits.maxRecipientsPerSub,
        ...schedule,
      })

      const scheduleError = validateCampaignPlanSchedules(plan, schedule)
      if (scheduleError) {
        return new Output(false, [], [scheduleError], null)
      }

      return new Output(true, [], [], {
        subCampaigns: plan.subCampaigns,
        needsSplit: plan.needsSplit,
        totalRecipients: plan.totalRecipients,
      })
    } catch (error) {
      console.error("[EmailCampaignUseCase][previewPlan]", error)
      return new Output(false, [], ["Erro ao gerar preview da campanha"], null)
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

      const [campaigns, total] = await prisma.$transaction([
        prisma.emailCampaign.findMany({
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
            errorMessage: true,
            _count: { select: { subCampaigns: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (options.page - 1) * options.pageSize,
          take: options.pageSize,
        }),
        prisma.emailCampaign.count({ where }),
      ])

      const creatorIds = Array.from(new Set(campaigns.map((campaign) => campaign.createdBy)))
      const templateIds = Array.from(new Set(campaigns.map((campaign) => campaign.templateId)))
      const contactListIds = Array.from(
        new Set(campaigns.map((campaign) => campaign.contactListId).filter((id): id is string => Boolean(id)))
      )

      const [creators, templates, contactLists] = await prisma.$transaction([
        prisma.profile.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, fullName: true, email: true },
        }),
        prisma.emailTemplate.findMany({
          where: { id: { in: templateIds }, teamId: ctx.teamId },
          select: { id: true, name: true },
        }),
        prisma.emailContactList.findMany({
          where: { id: { in: contactListIds }, teamId: ctx.teamId },
          select: { id: true, name: true },
        }),
      ])

      const parentIdsWithSubs = campaigns
        .filter((campaign) => campaign._count.subCampaigns > 0)
        .map((campaign) => campaign.id)

      const childAggregates =
        parentIdsWithSubs.length > 0
          ? await prisma.emailCampaign.groupBy({
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

      const aggregatesByParent = new Map(
        childAggregates.map((row) => [row.parentCampaignId as string, row._sum])
      )

      const dynamicRecipientCounts = new Map(
        await Promise.all(
          campaigns
            .filter(
              (campaign) =>
                campaign._count.subCampaigns === 0 &&
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
          return resolveEmailCreator({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            scheduledAt: campaign.scheduledAt,
            sentAt: campaign.sentAt,
            totalRecipients: dynamicRecipientCounts.get(campaign.id) ?? campaign.totalRecipients,
            totalSent: childSum?.totalSent ?? campaign.totalSent,
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
            errorMessage: campaign.errorMessage,
            subCampaignCount,
            isParentCampaign: subCampaignCount > 0,
            managedByCorretorStudio: Boolean(campaign.managedByBackofficeUserId),
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
      const campaign = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId },
        include: {
          template: { select: { id: true, name: true, subject: true } },
          contactList: { select: { id: true, name: true, totalContacts: true } },
          subCampaigns: {
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
              subCampaignIndex: true,
              contactListId: true,
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
          await prisma.emailTemplate.findFirst({
            where: { id: campaign.templateId, teamId: ctx.teamId },
            select: { html: true },
          })
        )?.html ?? null
      )

      return new Output(true, [], [], resolveEmailCreator({
        ...campaign,
        sourceContactListIds,
        linkedForm,
        totalRecipients: ["draft", "scheduled", "sending"].includes(campaign.status)
          ? activeRecipientCount
          : campaign.totalRecipients,
        partiallySentCount: isParent
          ? campaign.subCampaigns.filter((sub) => sub.status === "sent").length
          : undefined,
        partiallySentTotal: isParent ? campaign.subCampaigns.length : undefined,
        ...(childTotals ?? {}),
        subCampaignCount: campaign.subCampaigns.length,
        isParentCampaign: isParent,
        managedByCorretorStudio: Boolean(campaign.managedByBackofficeUserId),
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

      const teamSettings = await prisma.emailTeamSettings
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
      if (hasLists && hasRadar) {
        return new Output(false, [], ["Use apenas lista de contatos ou segmento Radar, não ambos"], null)
      }
      if (data.radarSegmentSlug && !(await isValidRadarSegmentAudience(ctx.teamId, data.radarSegmentSlug))) {
        return new Output(false, [], ["Segmento Radar inválido"], null)
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

      const schedule = this.parseScheduleInput(data)
      const trimmedName = data.name.trim()
      const teamLimits = await resolveTeamEmailCampaignLimits(ctx.teamId)
      const maxPerSub = teamLimits.maxRecipientsPerSub

      if (hasRadar) {
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
              `Segmentos Radar com mais de ${limitLabel} destinatários não são suportados. Use uma lista de contatos (com sub-campanhas) ou reduza o segmento`,
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
          templateId: data.templateId,
          contactListId: null,
          radarSegmentSlug: data.radarSegmentSlug ?? null,
          status: (schedule.scheduledAt ? "scheduled" : "draft") as EmailCampaignStatus,
          scheduledAt: schedule.scheduledAt,
          totalRecipients,
        }

        const customSegmentId = data.radarSegmentSlug?.startsWith(CUSTOM_RADAR_SEGMENT_PREFIX)
          ? data.radarSegmentSlug.slice(CUSTOM_RADAR_SEGMENT_PREFIX.length)
          : null

        if (!customSegmentId) {
          const campaign = await prisma.emailCampaign.create({ data: campaignData })
          return new Output(true, ["Campanha criada com sucesso"], [], campaign)
        }

        const campaign = await prisma.$transaction(async (tx) => {
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
        const campaign = await prisma.emailCampaign.create({
          data: {
            id: randomUUID(),
            teamId: ctx.teamId,
            createdBy: ctx.profileId,
            name: trimmedName,
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

      const result = await prisma.$transaction(async (tx) => {
        const parent = await tx.emailCampaign.create({
          data: {
            id: parentId,
            teamId: ctx.teamId,
            createdBy: ctx.profileId,
            name: trimmedName,
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
          const child = await tx.emailCampaign.create({
            data: {
              id: randomUUID(),
              teamId: ctx.teamId,
              createdBy: ctx.profileId,
              name: sub.name,
              templateId: data.templateId,
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
      const editableStatuses = ["draft", "scheduled", "sent", "failed", "partially_sent"] as const
      const existing = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: [...editableStatuses] } },
      })

      if (!existing) {
        const campaign = await prisma.emailCampaign.findFirst({
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
        (await prisma.emailCampaign.count({ where: { parentCampaignId: id, teamId: ctx.teamId } })) > 0
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
        if (nextSegmentSlug && requiresSubCampaignSplit(totalRecipients, maxPerSub)) {
          const limitLabel =
            maxPerSub?.toLocaleString("pt-BR") ??
            EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")
          return new Output(
            false,
            [],
            [
              `Segmentos Radar com mais de ${limitLabel} destinatários não são suportados. Use uma lista de contatos (com sub-campanhas) ou reduza o segmento`,
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
          const child = await prisma.emailCampaign.findFirst({
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

          await prisma.emailCampaign.update({
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

      const campaign = await prisma.emailCampaign.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.templateId !== undefined && { templateId: data.templateId }),
          ...(data.contactListId !== undefined && { contactListId: data.contactListId }),
          ...(data.radarSegmentSlug !== undefined && {
            radarSegmentSlug: data.radarSegmentSlug,
            ...(data.radarSegmentSlug ? { contactListId: null } : {}),
          }),
          ...(data.contactListId !== undefined && data.contactListId
            ? { radarSegmentSlug: null }
            : {}),
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
    const { _max } = await prisma.emailCampaignDispatch.aggregate({
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

  private buildDispatchFailureDetail(providerErrors: DispatchProviderError[]): string | null {
    if (providerErrors.length === 0) return null

    const parts = providerErrors.slice(0, 3).map((error) => {
      const technical = formatProviderBatchFailureMessage({
        message: error.message,
        statusCode: error.statusCode,
        emails: error.emails,
      })
      const friendly = isAlreadyFriendlyMessage(error.message)
        ? error.message
        : toFriendlyDispatchErrorMessage(
            typeof error.statusCode === "number"
              ? `${error.statusCode} ${error.message}`
              : error.message
          )
      console.error("[EmailCampaignUseCase][buildDispatchFailureDetail] erro técnico:", technical)
      return friendly
    })
    const remaining = providerErrors.length - parts.length
    return remaining > 0 ? `${parts.join(" | ")} | e mais ${remaining} lote(s) com falha` : parts.join(" | ")
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
    for (const recipient of params.recipients) {
      if (!params.dispatchedEmails.has(recipient.email)) continue

      const renderedSubject = interpolateEmailTemplate(
        params.subject,
        recipient,
        params.globalDefaults,
        params.templateVariables
      )

      void emailCampaignLeadActivityService
        .recordDispatchForRecipient({
          teamId: params.teamId,
          campaignId: params.campaignId,
          dispatchId: params.dispatchId,
          recipientEmail: recipient.email,
          subject: renderedSubject,
        })
        .catch((activityError) => {
          console.error("[EmailCampaignUseCase][recordDispatchLeadActivities]", activityError)
        })
    }
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
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: campaignId },
      select: { parentCampaignId: true },
    })
    if (campaign?.parentCampaignId) {
      await this.refreshParentCampaignStatus(campaign.parentCampaignId)
    }
  }

  async startManualDispatch(id: string, ctx: TeamContext): Promise<Output> {
    let previousStatus: EmailCampaignStatus | null = null
    let reservedCredits = 0
    let hasCampaignsBetaAccess = false

    try {
      const campaign = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: [...MANUAL_DISPATCH_STATUSES] } },
        include: {
          contactList: { select: { id: true, name: true, totalContacts: true } },
          team: { select: { master: { select: { id: true, timezone: true } } } },
        },
      })

      let teamSettings = null
      try {
        teamSettings = await prisma.emailTeamSettings.findUnique({ where: { teamId: ctx.teamId } })
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

      hasCampaignsBetaAccess = await featureAccessRepository.resolveEmailBetaAccess({
        profileId: ctx.profileId,
        managerId: ctx.managerId,
        isMaster: ctx.isMaster,
        teamId: ctx.teamId,
      })

      const defaultSender = await prisma.emailTeamSender
        .findFirst({
          where: { teamId: ctx.teamId, isDefault: true },
          select: { name: true, email: true },
        })
        .catch(() => null)

      const parentChildCount = await prisma.emailCampaign.count({
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

      if (dispatchInput.recipients.length === 0) {
        return new Output(
          false,
          [],
          [
            campaign.radarSegmentSlug
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
        additionalRecipients: dispatchInput.recipients.length,
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
        recipients: dispatchInput.recipients,
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

      const lockResult = await prisma.emailCampaign.updateMany({
        where: { id, teamId: ctx.teamId, status: { in: [...MANUAL_DISPATCH_STATUSES] } },
        data: { status: "sending", errorMessage: null },
      })

      if (lockResult.count === 0) {
        return new Output(false, [], ["Campanha não encontrada ou já está sendo enviada"], null)
      }

      const recipientsList = dispatchInput.recipients
      const creditsToReserve = recipientsList.length

      const creditReservation = await this.reserveTeamCreditsForDispatch(
        ctx.teamId,
        creditsToReserve,
        hasCampaignsBetaAccess
      )
      if (!creditReservation.ok) {
        await prisma.emailCampaign.update({
          where: { id },
          data: { status: previousStatus ?? "draft", errorMessage: creditReservation.message },
        })
        return new Output(false, [], [creditReservation.message], null)
      }
      reservedCredits = creditsToReserve

      const dispatchNumber = await this.getNextDispatchNumber(campaign.id)
      const dispatchRecord = await prisma.emailCampaignDispatch.create({
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
          totalRecipients: dispatchInput.recipients.length,
          status: "sending",
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
        status: "sending",
      }

      return new Output(true, ["Disparo iniciado em segundo plano"], [], job)
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

      const failedCampaign = await prisma.emailCampaign
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
      const stillSending = await prisma.emailCampaignDispatch.findFirst({
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
                globalDefaults: job.globalDefaults,
                templateVariables: job.templateVariables,
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

        const failureDetail = this.buildDispatchFailureDetail(dispatchResult.providerErrors)
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
            prisma.emailCampaign.findUnique({
              where: { id: job.campaignId },
              select: { name: true },
            }),
            prisma.emailCampaignDispatch.findUnique({
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

      await prisma.emailCampaignDispatch
        .update({
          where: { id: job.dispatchId },
          data: {
            status: "failed",
            errorMessage: failureMessage,
          },
        })
        .catch(() => null)

      const failedCampaign = await prisma.emailCampaign
        .update({
          where: { id: job.campaignId },
          data: {
            status: "failed",
            errorMessage: failureMessage,
          },
          select: { name: true },
        })
        .catch(() => null)

      const dispatchMeta = await prisma.emailCampaignDispatch
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

    return withDeadlockRetry(
      async () => {
        const [updatedCampaign] = await prisma.$transaction([
          prisma.emailCampaign.update({
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
          prisma.emailCampaignDispatch.update({
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
        onRetry: (attempt, error) => {
          console.error(
            `[EmailCampaignUseCase][commitDispatchTerminalState] deadlock retry attempt=${attempt}`,
            error
          )
        },
      }
    )
  }

  private async reconcileManualDispatchAfterError(job: ManualDispatchJob): Promise<Output | null> {
    const stillSending = await prisma.emailCampaignDispatch.findFirst({
      where: { id: job.dispatchId, teamId: job.teamId, status: "sending" },
      select: { id: true },
    })
    if (!stillSending) {
      return new Output(true, ["Disparo já finalizado"], [], {
        campaignId: job.campaignId,
        dispatchId: job.dispatchId,
      })
    }

    const sentCount = await prisma.emailLog.count({
      where: {
        dispatchId: job.dispatchId,
        status: { in: ["sent", "delivered", "opened", "clicked"] },
      },
    })
    if (sentCount <= 0) {
      return null
    }

    const terminal = resolveCampaignStatusAfterDispatch(sentCount)
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
  }

  /** Compat: executa start + complete de forma síncrona (testes / callers legados). */
  async send(id: string, ctx: TeamContext): Promise<Output> {
    const started = await this.startManualDispatch(id, ctx)
    if (!started.isValid || !started.result) {
      return started
    }
    return this.completeManualDispatch(started.result as ManualDispatchJob)
  }

  async recoverStuckSendingCampaigns(now = new Date()): Promise<number> {
    const threshold = new Date(now.getTime() - STUCK_SENDING_THRESHOLD_MS)

    const [campaigns, dispatches] = await prisma.$transaction([
      prisma.emailCampaign.updateMany({
        where: { status: "sending", updatedAt: { lt: threshold } },
        data: {
          status: "failed",
          errorMessage: EMAIL_CAMPAIGN_FAILURE_MESSAGES.STUCK_SENDING,
        },
      }),
      prisma.emailCampaignDispatch.updateMany({
        where: { status: "sending", updatedAt: { lt: threshold } },
        data: {
          status: "failed",
          errorMessage: EMAIL_CAMPAIGN_FAILURE_MESSAGES.STUCK_SENDING,
        },
      }),
    ])

    if (campaigns.count > 0) {
      console.error(
        `[EmailCampaignUseCase][recoverStuckSendingCampaigns] ${campaigns.count} campanha(s) marcada(s) como failed (timeout 30 min); ${dispatches.count} dispatch(es) atualizado(s)`
      )
    }

    return campaigns.count
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

    const orphanDispatches = await prisma.emailCampaignDispatch.findMany({
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
        const queuedLogs = await prisma.emailLog.findMany({
          where: { dispatchId: dispatch.id, status: "queued" },
          select: {
            id: true,
            recipientEmail: true,
            recipientName: true,
          },
        })

        if (queuedLogs.length === 0) {
          const sentCount = await prisma.emailLog.count({
            where: {
              dispatchId: dispatch.id,
              status: { in: ["sent", "delivered", "opened", "clicked"] },
            },
          })
          const terminal = resolveCampaignStatusAfterDispatch(sentCount)
          // lock order: campaign then dispatch (must match EmailLogRepository.applyWebhookEvent)
          await this.commitDispatchTerminalState({
            campaignId: dispatch.campaignId,
            dispatchId: dispatch.id,
            totalRecipients: dispatch.totalRecipients,
            sentCount,
            terminal,
            incrementSent: false,
            setDispatchTotalSent: true,
            setSentAt: terminal.campaignStatus === "sent" ? now : undefined,
            incrementDispatchCount: false,
          })
          resumed += 1
          continue
        }

        let teamSettings = null
        try {
          teamSettings = await prisma.emailTeamSettings.findUnique({
            where: { teamId: dispatch.teamId },
          })
        } catch {
          teamSettings = null
        }

        const defaultSender = await prisma.emailTeamSender
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
          status: "sending",
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

    const contacts = await prisma.emailContact.findMany({
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
    const updated = await prisma.emailCampaign.update({
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

    const campaigns = await prisma.emailCampaign.findMany({
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
        const lockResult = await prisma.emailCampaign.updateMany({
          where: { id: campaign.id, status: "scheduled" },
          data: { status: "sending" },
        })

        if (lockResult.count === 0) {
          continue
        }

        const masterId = campaign.team.master.id
        const ownerTz = resolveTimezone(campaign.team.master.timezone)

        const teamSettings = await prisma.emailTeamSettings
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
            },
          })
          .catch(() => null)

        if (teamSettings) {
          const windowCheck = checkDispatchWindow(now, ownerTz, {
            dispatchBlockedDates: teamSettings.dispatchBlockedDates as DispatchBlockedDateEntry[] | null,
            dispatchTimeFrom: teamSettings.dispatchTimeFrom,
            dispatchTimeTo: teamSettings.dispatchTimeTo,
          })
          if (windowCheck.blocked && windowCheck.defer) {
            await prisma.emailCampaign.update({
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

        const hasCampaignsBetaAccess = await featureAccessRepository.resolveEmailBetaAccess({
          profileId: masterId,
          managerId: masterId,
          isMaster: true,
          teamId: campaign.teamId,
        })

        const templateHtml = inlineEmailHtml(publishedTemplate.html)

        const defaultSender = await prisma.emailTeamSender
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
          await prisma.emailCampaign.update({
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
          await prisma.emailCampaign.update({
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
        const dispatchRecord = await prisma.emailCampaignDispatch.create({
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
                globalDefaults: dispatchInput.globalDefaults,
                templateVariables: dispatchInput.templateVariables,
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

        const failureDetail = this.buildDispatchFailureDetail(dispatchResult.providerErrors)
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

    const team = await prisma.team.findFirst({
      where: { id: params.teamId },
      select: { master: { select: { timezone: true } } },
    })
    const timezone = resolveTimezone(team?.master.timezone)
    const dayKey = formatLocalDateValue(params.scheduledAt, timezone)

    const siblings = await prisma.emailCampaign.findMany({
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

  private async refreshParentCampaignStatus(parentCampaignId: string): Promise<void> {
    const children = await prisma.emailCampaign.findMany({
      where: { parentCampaignId },
      select: { status: true, totalSent: true, totalDelivered: true, totalOpened: true, totalClicked: true, totalBounced: true, dispatchCount: true, sentAt: true },
    })
    if (children.length === 0) return

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

    await prisma.emailCampaign.update({
      where: { id: parentCampaignId },
      data: {
        status: parentStatus,
        ...totals,
        ...(parentStatus === "sent" && lastSentAt ? { sentAt: lastSentAt } : {}),
      },
    })
  }

  async cancel(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: "scheduled" },
        select: {
          id: true,
          parentCampaignId: true,
          _count: { select: { subCampaigns: true } },
        },
      })

      if (!existing) {
        return new Output(false, [], ["Campanha não encontrada ou não pode ser cancelada"], null)
      }

      if (existing._count.subCampaigns > 0) {
        await prisma.$transaction([
          prisma.emailCampaign.updateMany({
            where: {
              parentCampaignId: id,
              teamId: ctx.teamId,
              status: "scheduled",
            },
            data: { status: "canceled" },
          }),
          prisma.emailCampaign.update({
            where: { id },
            data: { status: "canceled" },
          }),
        ])
      } else {
        await prisma.emailCampaign.update({
          where: { id },
          data: { status: "canceled" },
        })
        if (existing.parentCampaignId) {
          await this.refreshParentCampaignStatus(existing.parentCampaignId)
        }
      }

      return new Output(true, ["Campanha cancelada com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailCampaignUseCase][cancel]", error)
      return new Output(false, [], ["Erro ao cancelar campanha"], null)
    }
  }

  async deleteDraft(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: ["draft", "scheduled", "canceled"] } },
      })

      if (!existing) {
        return new Output(false, [], ["Campanha não encontrada ou não pode ser excluída"], null)
      }

      await prisma.emailCampaign.delete({ where: { id } })

      return new Output(true, ["Campanha removida com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailCampaignUseCase][deleteDraft]", error)
      return new Output(false, [], ["Erro ao remover campanha"], null)
    }
  }

  async archive(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: ["sent", "failed", "partially_sent"] } },
      })

      if (!existing) {
        return new Output(false, [], ["Campanha não encontrada ou não pode ser arquivada"], null)
      }

      await prisma.emailCampaign.update({
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
