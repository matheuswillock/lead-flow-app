import { randomUUID } from "crypto"
import type { EmailCampaignStatus } from "@prisma/client"
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

const FALLBACK_FROM_NAME = process.env.RESEND_FROM_NAME ?? "Corretor Studio"
const FALLBACK_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "no-reply@corretorstudio.com"

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

  async send(id: string, ctx: TeamContext): Promise<Output> {
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

      const publishedTemplate = await this.resolvePublishedTemplate(campaign.templateId, ctx.teamId)
      if (!publishedTemplate) {
        return new Output(
          false,
          [],
          ["O template vinculado à campanha não é mais a versão publicada atual. Atualize a campanha antes de disparar"],
          null
        )
      }

      // Enforce dispatch restrictions from team settings
      if (teamSettings) {
        const allowedRoles: string[] = teamSettings.dispatchAllowedRoles ?? ["manager", "backoffice"]
        if (!allowedRoles.includes(ctx.teamMember.role)) {
          return new Output(false, [], ["Seu perfil não tem permissão para disparar campanhas"], null)
        }

        const todayStr = new Date().toISOString().slice(0, 10)
        type BlockedEntry = { date?: string; from?: string; to?: string }
        const blockedDates = ((teamSettings.dispatchBlockedDates as BlockedEntry[]) ?? [])
        for (const entry of blockedDates) {
          if (entry.date && entry.date === todayStr) {
            return new Output(false, [], [`Disparo bloqueado: a data ${todayStr} está na lista de restrições`], null)
          }
          if (entry.from && entry.to && todayStr >= entry.from && todayStr <= entry.to) {
            return new Output(false, [], [`Disparo bloqueado: data atual está no período bloqueado ${entry.from} – ${entry.to}`], null)
          }
        }

        if (teamSettings.dispatchTimeFrom && teamSettings.dispatchTimeTo) {
          const now = new Date()
          const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
          const [fH, fM] = teamSettings.dispatchTimeFrom.split(":").map(Number)
          const [tH, tM] = teamSettings.dispatchTimeTo.split(":").map(Number)
          const fromMinutes = fH * 60 + fM
          const toMinutes = tH * 60 + tM
          if (currentMinutes < fromMinutes || currentMinutes > toMinutes) {
            return new Output(
              false,
              [],
              [`Disparo bloqueado: horário permitido é ${teamSettings.dispatchTimeFrom} – ${teamSettings.dispatchTimeTo} (UTC)`],
              null
            )
          }
        }
      }

      if (!publishedTemplate.html) {
        return new Output(false, [], ["Template não possui HTML. Edite o template antes de disparar"], null)
      }

      const templateHtml = inlineEmailHtml(publishedTemplate.html)

      const masterId = campaign.team.master.id
      const hasCredits = await this.creditService.hasEnoughCredits(masterId)
      const hasCampaignsBetaAccess = await featureAccessRepository.resolveEmailBetaAccess(ctx)
      if (!hasCredits && !hasCampaignsBetaAccess) {
        return new Output(false, [], ["Sem assinatura de créditos de email ativa. Ative um plano em Assinaturas"], null)
      }

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
          [campaign.cdpSegmentSlug ? "Nenhum perfil apto no segmento CDP" : "Nenhum contato ativo na lista para envio"],
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

      const dispatchNumber = campaign.dispatchCount + 1
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

      const recipientsList = dispatchInput.recipients
      const { globalDefaults, templateVariables, from, replyTo } = dispatchInput

      const logIdsByEmail = new Map<string, string>()
      await Promise.all(
        recipientsList.map(async (recipient) => {
          const renderedSubject = interpolateEmailTemplate(
            dispatchInput.subject,
            recipient,
            globalDefaults,
            templateVariables
          )
          const logId = await teamEmailDispatchLogger.createQueuedTeamEmailLog({
            teamId: ctx.teamId,
            campaignId: campaign.id,
            dispatchId: dispatchRecord.id,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject: renderedSubject,
            category: "campaign",
            sourceType: "campaign",
            sourceId: campaign.id,
          })
          logIdsByEmail.set(recipient.email, logId)
        })
      )

      const dispatchResult = await this.dispatchService.dispatchBatch({
        from,
        replyTo,
        recipients: recipientsList,
        subject: dispatchInput.subject,
        html: dispatchInput.html,
        campaignId: campaign.id,
        teamId: ctx.teamId,
        globalDefaults,
        templateVariables,
      })

      const dispatchedEmails = new Set(dispatchResult.dispatched.map((entry) => entry.email))
      await Promise.all(
        dispatchResult.dispatched.map(({ email, resendId }) => {
          const logId = logIdsByEmail.get(email)
          if (!logId) return Promise.resolve()
          return teamEmailDispatchLogger.markTeamEmailLogSent(logId, resendId)
        })
      )
      await Promise.all(
        recipientsList
          .filter((recipient) => !dispatchedEmails.has(recipient.email))
          .map((recipient) => {
            const logId = logIdsByEmail.get(recipient.email)
            if (!logId) return Promise.resolve()
            return teamEmailDispatchLogger.markTeamEmailLogFailed(logId, "Falha no envio via Resend")
          })
      )

      if (dispatchResult.dispatched.length > 0 && hasCredits) {
        await this.creditService.deductCredits(masterId, dispatchResult.sent)
      }

      const dispatchStatus =
        dispatchResult.sent === 0 ? "failed" : dispatchResult.failed > 0 ? "completed" : "completed"

      await prisma.$transaction([
        prisma.emailCampaignDispatch.update({
          where: { id: dispatchRecord.id },
          data: {
            totalSent: dispatchResult.sent,
            status: dispatchStatus,
          },
        }),
        prisma.emailCampaign.update({
          where: { id },
          data: {
            status: "sent",
            sentAt: new Date(),
            totalRecipients: recipientsList.length,
            totalSent: { increment: dispatchResult.sent },
            dispatchCount: { increment: 1 },
          },
        }),
      ])

      return new Output(
        true,
        [`Campanha disparada para ${recipientsList.length} destinatário(s)`],
        dispatchResult.failed > 0 ? [`${dispatchResult.failed} emails falharam`] : [],
        {
          sent: dispatchResult.sent,
          failed: dispatchResult.failed,
          total: recipientsList.length,
          dispatchId: dispatchRecord.id,
          dispatchNumber,
        }
      )
    } catch (error) {
      console.error("[EmailCampaignUseCase][send]", error)
      await prisma.emailCampaign.update({
        where: { id },
        data: { status: "failed", errorMessage: "Erro interno durante o disparo" },
      }).catch(() => null)
      return new Output(false, [], ["Erro ao disparar campanha"], null)
    }
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
