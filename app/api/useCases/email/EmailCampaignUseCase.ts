import { randomUUID } from "crypto"
import type { EmailCampaignStatus } from "@prisma/client"
import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { EmailCampaignDispatchService } from "@/app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService"
import { EmailCampaignRecipientService } from "@/app/api/services/EmailCampaignDispatch/EmailCampaignRecipientService"
import { EmailCreditService } from "@/app/api/services/EmailCredit/EmailCreditService"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import { interpolateEmailTemplate } from "@/lib/email/interpolate"
import { inlineEmailHtml } from "@/lib/email/inline-email-html"
import { featureAccessRepository } from "@/app/api/infra/data/repositories/featureAccess/FeatureAccessRepository"
import { teamEmailDispatchLogger } from "@/lib/email/team-email-dispatch-logger"
import { isCdpSegmentSlug } from "@/lib/cdp/segment-config"
import { listCdpSegmentEmailRecipients } from "@/lib/cdp/list-segment-recipients"
import { withConcurrencyLimit } from "@/lib/async/with-concurrency-limit"
import { formatIntimezone, resolveTimezone } from "@/lib/dates"
import {
  checkDispatchWindow,
  resolveCampaignStatusAfterDispatch,
  type DispatchBlockedDateEntry,
} from "@/lib/email/campaign-dispatch-guards"
import { canDispatchEmail } from "@/lib/email/email-rbac"
import { emailOrphanEventService } from "@/app/api/services/resend/EmailOrphanEventService"

const FALLBACK_FROM_NAME = process.env.RESEND_FROM_NAME ?? "Corretor Studio"
const FALLBACK_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "no-reply@corretorstudio.com"
const EMAIL_LOG_WRITE_CONCURRENCY_LIMIT = 2
const STUCK_SENDING_THRESHOLD_MS = 30 * 60 * 1000
const DEFAULT_SCHEDULED_BATCH_SIZE = 5

export const EMAIL_CAMPAIGN_FAILURE_MESSAGES = {
  NO_HTML: "Template sem HTML. Edite o template antes de disparar",
  NO_CREDITS: "Sem assinatura de créditos de e-mail ativa. Ative um plano em Assinaturas",
  NO_RECIPIENTS_LIST: "Nenhum contato ativo na lista para envio",
  NO_RECIPIENTS_CDP: "Nenhum perfil apto no segmento CDP",
  STUCK_SENDING: "Disparo interrompido: tempo limite de envio excedido (30 min)",
  INTERNAL: "Erro interno durante o disparo",
  RESEND_ZERO: "Nenhum e-mail foi enviado pelo provedor",
} as const

export interface CreateCampaignInput {
  name: string
  templateId: string
  contactListId?: string
  cdpSegmentSlug?: string
  scheduledAt?: string | null
}

export class EmailCampaignUseCase {
  private dispatchService = new EmailCampaignDispatchService()
  private recipientService = new EmailCampaignRecipientService()
  private creditService = new EmailCreditService()

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
    options: { contactListId?: string | null; cdpSegmentSlug?: string | null }
  ): Promise<number> {
    if (options.cdpSegmentSlug) {
      const recipients = await listCdpSegmentEmailRecipients(teamId, options.cdpSegmentSlug)
      return recipients.length
    }
    if (!options.contactListId) return 0
    const recipients = await this.recipientService.listActiveRecipients(teamId, options.contactListId)
    return recipients.length
  }

  async list(ctx: TeamContext, options: { status?: string; page: number; pageSize: number }): Promise<Output> {
    try {
      const where = {
        teamId: ctx.teamId,
        ...(options.status && { status: options.status as EmailCampaignStatus }),
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
            templateId: true,
            contactListId: true,
            cdpSegmentSlug: true,
            errorMessage: true,
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

      const dynamicRecipientCounts = new Map(
        await Promise.all(
          campaigns
            .filter((campaign) => ["draft", "scheduled", "sending"].includes(campaign.status))
            .map(async (campaign) => {
              const count = await this.countActiveRecipients(ctx.teamId, {
                contactListId: campaign.contactListId,
                cdpSegmentSlug: campaign.cdpSegmentSlug,
              })
              return [campaign.id, count] as const
            })
        )
      )

      const creatorsById = new Map(creators.map((creator) => [creator.id, creator]))
      const templatesById = new Map(templates.map((template) => [template.id, template]))
      const contactListsById = new Map(contactLists.map((contactList) => [contactList.id, contactList]))

      return new Output(true, [], [], {
        campaigns: campaigns.map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          scheduledAt: campaign.scheduledAt,
          sentAt: campaign.sentAt,
          totalRecipients: dynamicRecipientCounts.get(campaign.id) ?? campaign.totalRecipients,
          totalSent: campaign.totalSent,
          totalDelivered: campaign.totalDelivered,
          totalOpened: campaign.totalOpened,
          totalClicked: campaign.totalClicked,
          totalBounced: campaign.totalBounced,
          dispatchCount: campaign.dispatchCount,
          createdAt: campaign.createdAt,
          creator: creatorsById.get(campaign.createdBy) ?? null,
          template: templatesById.get(campaign.templateId) ?? null,
          contactList: campaign.contactListId ? contactListsById.get(campaign.contactListId) ?? null : null,
          cdpSegmentSlug: campaign.cdpSegmentSlug,
          errorMessage: campaign.errorMessage,
        })),
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
        },
      })

      if (!campaign) {
        return new Output(false, [], ["Campanha não encontrada"], null)
      }

      const activeRecipientCount = await this.countActiveRecipients(ctx.teamId, {
        contactListId: campaign.contactListId,
        cdpSegmentSlug: campaign.cdpSegmentSlug,
      })

      return new Output(true, [], [], {
        ...campaign,
        totalRecipients: ["draft", "scheduled", "sending"].includes(campaign.status)
          ? activeRecipientCount
          : campaign.totalRecipients,
      })
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

      if (!data.contactListId && !data.cdpSegmentSlug) {
        return new Output(false, [], ["Selecione uma lista de contatos ou um segmento CDP"], null)
      }
      if (data.contactListId && data.cdpSegmentSlug) {
        return new Output(false, [], ["Use apenas lista de contatos ou segmento CDP, não ambos"], null)
      }
      if (data.cdpSegmentSlug && !isCdpSegmentSlug(data.cdpSegmentSlug)) {
        return new Output(false, [], ["Segmento CDP inválido"], null)
      }

      const template = await this.findCurrentPublishedTemplate(data.templateId, ctx.teamId)
      const contactList = data.contactListId
        ? await prisma.emailContactList.findFirst({
            where: { id: data.contactListId, teamId: ctx.teamId, isArchived: false },
          })
        : null

      if (!template) {
        return new Output(
          false,
          [],
          ["Template não encontrado ou não é a versão publicada atual. Selecione a versão vigente do template"],
          null
        )
      }
      if (data.contactListId && !contactList) {
        return new Output(false, [], ["Lista de contatos não encontrada ou não pertence ao time"], null)
      }

      const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null
      if (scheduledAt && scheduledAt <= new Date()) {
        return new Output(false, [], ["Data de agendamento deve ser no futuro"], null)
      }

      const totalRecipients = await this.countActiveRecipients(ctx.teamId, {
        contactListId: data.contactListId,
        cdpSegmentSlug: data.cdpSegmentSlug,
      })

      const campaign = await prisma.emailCampaign.create({
        data: {
          id: randomUUID(),
          teamId: ctx.teamId,
          createdBy: ctx.profileId,
          name: data.name.trim(),
          templateId: data.templateId,
          contactListId: data.contactListId ?? null,
          cdpSegmentSlug: data.cdpSegmentSlug ?? null,
          status: scheduledAt ? "scheduled" : "draft",
          scheduledAt,
          totalRecipients,
        },
      })

      return new Output(true, ["Campanha criada com sucesso"], [], campaign)
    } catch (error) {
      console.error("[EmailCampaignUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar campanha"], null)
    }
  }

  async update(id: string, data: Partial<CreateCampaignInput>, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: ["draft", "scheduled"] } },
      })

      if (!existing) {
        const campaign = await prisma.emailCampaign.findFirst({
          where: { id, teamId: ctx.teamId },
          select: { status: true },
        })
        if (!campaign) {
          return new Output(false, [], ["Campanha não encontrada"], null)
        }
        if (campaign.status === "sent") {
          return new Output(false, [], ["Campanha já enviada não pode ser editada"], null)
        }
        if (campaign.status === "sending") {
          return new Output(false, [], ["Campanha em envio não pode ser editada"], null)
        }
        return new Output(false, [], ["Campanha não pode ser editada no status atual"], null)
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
      if (data.contactListId !== undefined || data.cdpSegmentSlug !== undefined) {
        const nextContactListId = data.contactListId !== undefined ? data.contactListId : existing.contactListId
        const nextSegmentSlug =
          data.cdpSegmentSlug !== undefined ? data.cdpSegmentSlug : existing.cdpSegmentSlug
        totalRecipients = await this.countActiveRecipients(ctx.teamId, {
          contactListId: nextContactListId,
          cdpSegmentSlug: nextSegmentSlug,
        })
      }

      const campaign = await prisma.emailCampaign.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.templateId !== undefined && { templateId: data.templateId }),
          ...(data.contactListId !== undefined && { contactListId: data.contactListId }),
          ...(data.cdpSegmentSlug !== undefined && {
            cdpSegmentSlug: data.cdpSegmentSlug,
            ...(data.cdpSegmentSlug ? { contactListId: null } : {}),
          }),
          ...(data.contactListId !== undefined && data.contactListId
            ? { cdpSegmentSlug: null }
            : {}),
          ...(totalRecipients !== undefined && { totalRecipients }),
          ...(data.scheduledAt !== undefined && {
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
            status: data.scheduledAt ? "scheduled" : "draft",
          }),
        },
      })

      const resolvedRecipientCount = await this.countActiveRecipients(ctx.teamId, {
        contactListId: campaign.contactListId,
        cdpSegmentSlug: campaign.cdpSegmentSlug,
      })

      return new Output(true, ["Campanha atualizada com sucesso"], [], {
        ...campaign,
        totalRecipients: ["draft", "scheduled", "sending"].includes(campaign.status)
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

  async send(id: string, ctx: TeamContext): Promise<Output> {
    let previousStatus: EmailCampaignStatus | null = null
    let dispatchRecordId: string | null = null

    try {
      const campaign = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: ["draft", "scheduled", "sent"] } },
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

      // Enforce dispatch window restrictions from team settings
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

      const hasCampaignsBetaAccess = await featureAccessRepository.resolveEmailBetaAccess({
        profileId: ctx.profileId,
        managerId: ctx.managerId,
        isMaster: ctx.isMaster,
        teamId: ctx.teamId,
      })

      const dispatchInput = await this.recipientService.buildCampaignDispatchInput({
        teamId: ctx.teamId,
        contactListId: campaign.contactListId,
        cdpSegmentSlug: campaign.cdpSegmentSlug,
        template: {
          subject: publishedTemplate.subject,
          html: templateHtml,
          variables: publishedTemplate.variables,
        },
        teamSettings,
        masterTimezone: campaign.team.master.timezone,
        fallbackFromName: FALLBACK_FROM_NAME,
        fallbackFromEmail: FALLBACK_FROM_EMAIL,
      })

      if (dispatchInput.recipients.length === 0) {
        return new Output(
          false,
          [],
          [
            campaign.cdpSegmentSlug
              ? EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_CDP
              : EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_LIST,
          ],
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
        where: { id, teamId: ctx.teamId, status: { in: ["draft", "scheduled", "sent"] } },
        data: { status: "sending" },
      })

      if (lockResult.count === 0) {
        return new Output(false, [], ["Campanha não encontrada ou já está sendo enviada"], null)
      }

      const recipientsList = dispatchInput.recipients
      const reservedCredits = recipientsList.length

      const creditReservation = await this.reserveTeamCreditsForDispatch(
        ctx.teamId,
        reservedCredits,
        hasCampaignsBetaAccess
      )
      if (!creditReservation.ok) {
        await prisma.emailCampaign.update({
          where: { id },
          data: { status: previousStatus ?? "draft", errorMessage: creditReservation.message },
        })
        return new Output(false, [], [creditReservation.message], null)
      }

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
          cdpSegmentSlug: campaign.cdpSegmentSlug,
          triggeredBy: ctx.profileId,
          totalRecipients: dispatchInput.recipients.length,
          status: "sending",
        },
      })
      dispatchRecordId = dispatchRecord.id

      const { globalDefaults, templateVariables, from, replyTo } = dispatchInput
      let sentCount = 0

      try {
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
        const logIdsByEmail = new Map(createdLogs.map(({ email, logId }) => [email, logId]))

        const dispatchResult = await this.dispatchService.dispatchBatch({
          from,
          replyTo,
          recipients: recipientsList,
          subject: dispatchInput.subject,
          html: dispatchInput.html,
          campaignId: campaign.id,
          teamId: ctx.teamId,
          dispatchNumber,
          globalDefaults,
          templateVariables,
        })

        sentCount = dispatchResult.sent

        const dispatchedEmails = new Set(dispatchResult.dispatched.map((entry) => entry.email))
        await withConcurrencyLimit(
          dispatchResult.dispatched,
          EMAIL_LOG_WRITE_CONCURRENCY_LIMIT,
          async ({ email, resendId }) => {
            const logId = logIdsByEmail.get(email)
            if (!logId) return
            await teamEmailDispatchLogger.markTeamEmailLogSent(logId, resendId)
          }
        )
        await withConcurrencyLimit(
          recipientsList.filter((recipient) => !dispatchedEmails.has(recipient.email)),
          EMAIL_LOG_WRITE_CONCURRENCY_LIMIT,
          async (recipient) => {
            const logId = logIdsByEmail.get(recipient.email)
            if (!logId) return
            await teamEmailDispatchLogger.markTeamEmailLogFailed(logId, "Falha no envio via Resend")
          }
        )

        const terminal = resolveCampaignStatusAfterDispatch(dispatchResult.sent)

        await prisma.$transaction([
          prisma.emailCampaignDispatch.update({
            where: { id: dispatchRecord.id },
            data: {
              totalSent: dispatchResult.sent,
              status: terminal.dispatchStatus,
            },
          }),
          prisma.emailCampaign.update({
            where: { id },
            data: {
              status: terminal.campaignStatus,
              sentAt: terminal.campaignStatus === "sent" ? new Date() : undefined,
              errorMessage: terminal.errorMessage,
              totalRecipients: recipientsList.length,
              totalSent: { increment: dispatchResult.sent },
              dispatchCount: { increment: 1 },
            },
          }),
        ])

        if (terminal.campaignStatus === "failed") {
          return new Output(
            false,
            [],
            [terminal.errorMessage ?? EMAIL_CAMPAIGN_FAILURE_MESSAGES.RESEND_ZERO],
            {
              sent: dispatchResult.sent,
              failed: dispatchResult.failed,
              total: recipientsList.length,
              dispatchId: dispatchRecord.id,
              dispatchNumber,
            }
          )
        }

        return new Output(
          true,
          [`Campanha disparada para ${recipientsList.length} destinatário(s)`],
          dispatchResult.failed > 0 ? [`${dispatchResult.failed} e-mails falharam`] : [],
          {
            sent: dispatchResult.sent,
            failed: dispatchResult.failed,
            total: recipientsList.length,
            dispatchId: dispatchRecord.id,
            dispatchNumber,
          }
        )
      } finally {
        await this.releaseUnusedTeamCredits(
          ctx.teamId,
          reservedCredits,
          sentCount,
          hasCampaignsBetaAccess
        )
      }
    } catch (error) {
      console.error("[EmailCampaignUseCase][send]", error)

      if (dispatchRecordId) {
        await prisma.emailCampaignDispatch
          .update({
            where: { id: dispatchRecordId },
            data: { status: "failed" },
          })
          .catch(() => null)
      }

      const restoreStatus: EmailCampaignStatus =
        previousStatus && ["draft", "scheduled", "sent"].includes(previousStatus)
          ? previousStatus
          : "failed"

      await prisma.emailCampaign
        .update({
          where: { id },
          data: {
            status: restoreStatus,
            errorMessage: EMAIL_CAMPAIGN_FAILURE_MESSAGES.INTERNAL,
          },
        })
        .catch(() => null)

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return new Output(false, [], ["Conflito de numeração de disparo. Tente novamente."], null)
      }

      return new Output(false, [], ["Erro ao disparar campanha"], null)
    }
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
        data: { status: "failed" },
      }),
    ])

    if (campaigns.count > 0) {
      console.error(
        `[EmailCampaignUseCase][recoverStuckSendingCampaigns] ${campaigns.count} campanha(s) marcada(s) como failed (timeout 30 min); ${dispatches.count} dispatch(es) atualizado(s)`
      )
    }

    return campaigns.count
  }

  private async markScheduledCampaignFailed(campaignId: string, errorMessage: string): Promise<void> {
    console.error(`[EmailCampaignUseCase][dispatchScheduled] campaignId=${campaignId} motivo=${errorMessage}`)
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "failed", errorMessage },
    })
  }

  async dispatchScheduledCampaigns(options?: { maxCampaigns?: number; now?: Date }): Promise<Output> {
    const now = options?.now ?? new Date()
    const maxCampaigns = options?.maxCampaigns ?? DEFAULT_SCHEDULED_BATCH_SIZE

    await this.recoverStuckSendingCampaigns(now)

    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        status: "scheduled",
        scheduledAt: { lte: now },
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

        const dispatchInput = await this.recipientService.buildCampaignDispatchInput({
          teamId: campaign.teamId,
          contactListId: campaign.contactListId,
          cdpSegmentSlug: campaign.cdpSegmentSlug,
          template: {
            subject: publishedTemplate.subject,
            html: templateHtml,
            variables: publishedTemplate.variables,
          },
          teamSettings,
          masterTimezone: campaign.team.master.timezone,
          fallbackFromName: FALLBACK_FROM_NAME,
          fallbackFromEmail: FALLBACK_FROM_EMAIL,
        })

        if (dispatchInput.recipients.length === 0) {
          const noRecipientsMessage = campaign.cdpSegmentSlug
            ? EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_CDP
            : EMAIL_CAMPAIGN_FAILURE_MESSAGES.NO_RECIPIENTS_LIST
          await this.markScheduledCampaignFailed(campaign.id, noRecipientsMessage)
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
            cdpSegmentSlug: campaign.cdpSegmentSlug,
            triggeredBy: campaign.createdBy,
            totalRecipients: dispatchInput.recipients.length,
            status: "sending",
          },
        })

        const recipientsList = dispatchInput.recipients
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

        const dispatchResult = await this.dispatchService.dispatchBatch({
          from: dispatchInput.from,
          replyTo: dispatchInput.replyTo,
          recipients: recipientsList,
          subject: dispatchInput.subject,
          html: dispatchInput.html,
          campaignId: campaign.id,
          teamId: campaign.teamId,
          dispatchNumber,
          globalDefaults: dispatchInput.globalDefaults,
          templateVariables: dispatchInput.templateVariables,
        })

        sentCount = dispatchResult.sent

        const dispatchedEmails = new Set(dispatchResult.dispatched.map((entry) => entry.email))
        await withConcurrencyLimit(
          dispatchResult.dispatched,
          EMAIL_LOG_WRITE_CONCURRENCY_LIMIT,
          async ({ email, resendId }) => {
            const logId = logIdsByEmail.get(email)
            if (!logId) return
            await teamEmailDispatchLogger.markTeamEmailLogSent(logId, resendId)
          }
        )
        await withConcurrencyLimit(
          recipientsList.filter((recipient) => !dispatchedEmails.has(recipient.email)),
          EMAIL_LOG_WRITE_CONCURRENCY_LIMIT,
          async (recipient) => {
            const logId = logIdsByEmail.get(recipient.email)
            if (!logId) return
            await teamEmailDispatchLogger.markTeamEmailLogFailed(logId, "Falha no envio via Resend")
          }
        )

        const terminal = resolveCampaignStatusAfterDispatch(dispatchResult.sent)

        await prisma.$transaction([
          prisma.emailCampaignDispatch.update({
            where: { id: dispatchRecord.id },
            data: {
              totalSent: dispatchResult.sent,
              status: terminal.dispatchStatus,
            },
          }),
          prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: {
              status: terminal.campaignStatus,
              sentAt: terminal.campaignStatus === "sent" ? new Date() : undefined,
              errorMessage: terminal.errorMessage,
              totalRecipients: recipientsList.length,
              totalSent: { increment: dispatchResult.sent },
              dispatchCount: { increment: 1 },
            },
          }),
        ])

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
        await this.markScheduledCampaignFailed(campaign.id, EMAIL_CAMPAIGN_FAILURE_MESSAGES.INTERNAL)
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

  async cancel(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: "scheduled" },
      })

      if (!existing) {
        return new Output(false, [], ["Campanha não encontrada ou não pode ser cancelada"], null)
      }

      await prisma.emailCampaign.update({
        where: { id },
        data: { status: "canceled" },
      })

      return new Output(true, ["Campanha cancelada com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailCampaignUseCase][cancel]", error)
      return new Output(false, [], ["Erro ao cancelar campanha"], null)
    }
  }

  async deleteDraft(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: "draft" },
      })

      if (!existing) {
        return new Output(false, [], ["Rascunho não encontrado"], null)
      }

      await prisma.emailCampaign.delete({ where: { id } })

      return new Output(true, ["Rascunho removido com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailCampaignUseCase][deleteDraft]", error)
      return new Output(false, [], ["Erro ao remover rascunho"], null)
    }
  }
}
