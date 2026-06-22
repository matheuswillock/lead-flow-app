import { randomUUID } from "crypto"
import type { EmailCampaignStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { EmailCampaignDispatchService } from "@/app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService"
import { EmailCreditService } from "@/app/api/services/EmailCredit/EmailCreditService"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import type { EmailTemplateVariableDefinition } from "@/lib/email/interpolate"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"

const FALLBACK_FROM_NAME = process.env.RESEND_FROM_NAME ?? "Corretor Studio"
const FALLBACK_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "no-reply@corretorstudio.com"

export interface CreateCampaignInput {
  name: string
  templateId: string
  contactListId: string
  scheduledAt?: string | null
}

type CampaignRecipient = {
  email: string
  name: string | null
  customFields: Record<string, unknown> | null
}

export class EmailCampaignUseCase {
  private dispatchService = new EmailCampaignDispatchService()
  private creditService = new EmailCreditService()

  private dedupeRecipients(recipients: CampaignRecipient[]): CampaignRecipient[] {
    const uniqueRecipients = new Map<string, CampaignRecipient>()

    for (const recipient of recipients) {
      const normalizedEmail = recipient.email.trim().toLowerCase()
      if (!uniqueRecipients.has(normalizedEmail)) {
        uniqueRecipients.set(normalizedEmail, {
          ...recipient,
          email: normalizedEmail,
        })
      }
    }

    return Array.from(uniqueRecipients.values())
  }

  private async listActiveRecipients(teamId: string, contactListId: string): Promise<CampaignRecipient[]> {
    const contactList = await prisma.emailContactList.findFirst({
      where: { id: contactListId, teamId, isArchived: false },
      select: { id: true, isSystemDefault: true },
    })

    if (!contactList) {
      return []
    }

    if (contactList.isSystemDefault) {
      const recipients = await prisma.emailContact.findMany({
        where: {
          isUnsubscribed: false,
          isBounced: false,
          list: {
            teamId,
            isArchived: false,
          },
        },
        orderBy: { updatedAt: "desc" },
        select: {
          email: true,
          name: true,
          customFields: true,
        },
      })

      return this.dedupeRecipients(
        recipients.map((recipient) => ({
          email: recipient.email,
          name: recipient.name,
          customFields: recipient.customFields as Record<string, unknown> | null,
        }))
      )
    }

    const recipients = await prisma.emailContact.findMany({
      where: {
        listId: contactListId,
        isUnsubscribed: false,
        isBounced: false,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        email: true,
        name: true,
        customFields: true,
      },
    })

    return recipients.map((recipient) => ({
      email: recipient.email,
      name: recipient.name,
      customFields: recipient.customFields as Record<string, unknown> | null,
    }))
  }

  private async findCurrentPublishedTemplate(templateId: string, teamId: string) {
    return prisma.emailTemplate.findFirst({
      where: {
        id: templateId,
        teamId,
        isArchived: false,
        approvalStatus: "approved",
        status: "published",
        isCurrentPublished: true,
      },
      select: { id: true },
    })
  }

  private async countActiveRecipients(teamId: string, contactListId: string): Promise<number> {
    const recipients = await this.listActiveRecipients(teamId, contactListId)
    return recipients.length
  }

  private async resolveEffectiveCampaignFeature() {
    type CampaignFeatureNode = {
      id: string
      parentId: string | null
      inheritParentSettings: boolean
      betaEnabled: boolean
    }

    const visited = new Set<string>()
    let current: CampaignFeatureNode | null = await prisma.backofficeFeature.findFirst({
      where: { slug: FEATURE_SLUGS.EMAIL_CAMPAIGNS, isActive: true },
      select: { id: true, parentId: true, inheritParentSettings: true, betaEnabled: true },
    })

    if (!current) return null

    while (current.inheritParentSettings && current.parentId && !visited.has(current.id)) {
      visited.add(current.id)
      const parent: (CampaignFeatureNode & { isActive: boolean }) | null = await prisma.backofficeFeature.findUnique({
        where: { id: current.parentId },
        select: { id: true, parentId: true, inheritParentSettings: true, betaEnabled: true, isActive: true },
      })
      if (!parent || !parent.isActive) break
      current = parent
    }

    return current
  }

  private async getGlobalDefaults(teamId: string): Promise<Record<string, string>> {
    try {
      const variables = await prisma.emailTeamVariable.findMany({
        where: { teamId, isActive: true, defaultValue: { not: null } },
        select: { key: true, defaultValue: true },
      })
      return variables.reduce<Record<string, string>>((acc, v) => {
        if (v.defaultValue != null) acc[v.key] = v.defaultValue
        return acc
      }, {})
    } catch (error) {
      console.error("[EmailCampaignUseCase][getGlobalDefaults]", error)
      return {}
    }
  }

  private async hasCampaignsBetaAccess(profileId: string): Promise<boolean> {
    const feature = await prisma.backofficeFeature.findFirst({
      where: { slug: FEATURE_SLUGS.EMAIL_CAMPAIGNS, isActive: true },
      select: { id: true, betaEnabled: true },
    })

    if (!feature) return false

    const effectiveFeature = await this.resolveEffectiveCampaignFeature()
    const betaFeatureId = effectiveFeature?.betaEnabled ? effectiveFeature.id : feature.betaEnabled ? feature.id : null

    if (!betaFeatureId) return false

    const featureIds = Array.from(new Set([feature.id, betaFeatureId]))
    const betaGrant = await prisma.backofficeFeatureGrant.findFirst({
      where: {
        profileId,
        grantType: "BETA",
        isActive: true,
        featureId: { in: featureIds },
      },
      select: { id: true },
    })

    return !!betaGrant
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
          },
          orderBy: { createdAt: "desc" },
          skip: (options.page - 1) * options.pageSize,
          take: options.pageSize,
        }),
        prisma.emailCampaign.count({ where }),
      ])

      const creatorIds = Array.from(new Set(campaigns.map((campaign) => campaign.createdBy)))
      const templateIds = Array.from(new Set(campaigns.map((campaign) => campaign.templateId)))
      const contactListIds = Array.from(new Set(campaigns.map((campaign) => campaign.contactListId)))

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
          Array.from(
            new Set(
              campaigns
                .filter((campaign) => ["draft", "scheduled", "sending"].includes(campaign.status))
                .map((campaign) => campaign.contactListId)
            )
          ).map(async (contactListId) => [contactListId, await this.countActiveRecipients(ctx.teamId, contactListId)] as const)
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
          totalRecipients: dynamicRecipientCounts.get(campaign.contactListId) ?? campaign.totalRecipients,
          totalSent: campaign.totalSent,
          totalDelivered: campaign.totalDelivered,
          totalOpened: campaign.totalOpened,
          totalClicked: campaign.totalClicked,
          totalBounced: campaign.totalBounced,
          dispatchCount: campaign.dispatchCount,
          createdAt: campaign.createdAt,
          creator: creatorsById.get(campaign.createdBy) ?? null,
          template: templatesById.get(campaign.templateId) ?? null,
          contactList: contactListsById.get(campaign.contactListId) ?? null,
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

      return new Output(true, [], [], campaign)
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

      const [template, contactList] = await Promise.all([
        this.findCurrentPublishedTemplate(data.templateId, ctx.teamId),
        prisma.emailContactList.findFirst({ where: { id: data.contactListId, teamId: ctx.teamId, isArchived: false } }),
      ])

      if (!template) {
        return new Output(
          false,
          [],
          ["Template não encontrado ou não é a versão publicada atual. Selecione a versão vigente do template"],
          null
        )
      }
      if (!contactList) {
        return new Output(false, [], ["Lista de contatos não encontrada ou não pertence ao time"], null)
      }

      const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null
      if (scheduledAt && scheduledAt <= new Date()) {
        return new Output(false, [], ["Data de agendamento deve ser no futuro"], null)
      }

      const totalRecipients = await this.countActiveRecipients(ctx.teamId, data.contactListId)

      const campaign = await prisma.emailCampaign.create({
        data: {
          id: randomUUID(),
          teamId: ctx.teamId,
          createdBy: ctx.profileId,
          name: data.name.trim(),
          templateId: data.templateId,
          contactListId: data.contactListId,
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
        where: { id, teamId: ctx.teamId, status: "draft" },
      })

      if (!existing) {
        return new Output(false, [], ["Campanha não encontrada ou não pode ser editada"], null)
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
      if (data.contactListId !== undefined) {
        totalRecipients = await this.countActiveRecipients(ctx.teamId, data.contactListId)
      }

      const campaign = await prisma.emailCampaign.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.templateId !== undefined && { templateId: data.templateId }),
          ...(data.contactListId !== undefined && { contactListId: data.contactListId }),
          ...(totalRecipients !== undefined && { totalRecipients }),
          ...(data.scheduledAt !== undefined && {
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
            status: data.scheduledAt ? "scheduled" : "draft",
          }),
        },
      })

      return new Output(true, ["Campanha atualizada com sucesso"], [], campaign)
    } catch (error) {
      console.error("[EmailCampaignUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar campanha"], null)
    }
  }

  async send(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const campaign = await prisma.emailCampaign.findFirst({
        where: { id, teamId: ctx.teamId, status: { in: ["draft", "scheduled"] } },
        include: {
          template: { select: { id: true, subject: true, html: true, variables: true } },
          contactList: { select: { id: true, name: true, totalContacts: true } },
          team: { select: { master: { select: { id: true } } } },
        },
      })

      let teamSettings = null
      try {
        teamSettings = await prisma.emailTeamSettings.findUnique({ where: { teamId: ctx.teamId } })
      } catch {
        // fall back to env defaults if model unavailable in current client build
      }

      if (!campaign) {
        return new Output(false, [], ["Campanha não encontrada ou já foi enviada"], null)
      }

      const currentTemplate = await this.findCurrentPublishedTemplate(campaign.templateId, ctx.teamId)
      if (!currentTemplate) {
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

      if (!campaign.template.html) {
        return new Output(false, [], ["Template não possui HTML. Edite o template antes de disparar"], null)
      }

      const masterId = campaign.team.master.id
      const hasCredits = await this.creditService.hasEnoughCredits(masterId)
      const hasCampaignsBetaAccess = await this.hasCampaignsBetaAccess(ctx.profileId)
      if (!hasCredits && !hasCampaignsBetaAccess) {
        return new Output(false, [], ["Sem assinatura de créditos de email ativa. Ative um plano em Assinaturas"], null)
      }

      // Marcar como sending de forma atômica para evitar envios duplicados concorrentes
      const lockResult = await prisma.emailCampaign.updateMany({
        where: { id, teamId: ctx.teamId, status: { in: ["draft", "scheduled"] } },
        data: { status: "sending" },
      })

      if (lockResult.count === 0) {
        return new Output(false, [], ["Campanha não encontrada ou já está sendo enviada"], null)
      }

      // Buscar contatos ativos
      const contacts = await this.listActiveRecipients(ctx.teamId, campaign.contactListId)

      if (contacts.length === 0) {
        await prisma.emailCampaign.update({
          where: { id },
          data: { status: "failed", errorMessage: "Nenhum contato ativo na lista" },
        })
        return new Output(false, [], ["Nenhum contato ativo na lista para envio"], null)
      }

      const recipientsList = contacts.map((c) => ({
        email: c.email,
        name: c.name,
        customFields: c.customFields as Record<string, unknown> | null,
      }))

      const fromName = teamSettings?.fromName ?? FALLBACK_FROM_NAME
      const fromEmail = teamSettings?.fromEmail ?? FALLBACK_FROM_EMAIL
      const from = `${fromName} <${fromEmail}>`
      const replyTo = teamSettings?.replyTo ?? null

      // Team global variables (default values) used as interpolation fallback
      const globalDefaults = await this.getGlobalDefaults(ctx.teamId)
      const templateVariables = Array.isArray(campaign.template.variables)
        ? (campaign.template.variables as unknown as EmailTemplateVariableDefinition[])
        : []

      // Dispatch
      const dispatchResult = await this.dispatchService.dispatchBatch({
        from,
        replyTo,
        recipients: recipientsList,
        subject: campaign.template.subject,
        html: campaign.template.html,
        campaignId: campaign.id,
        teamId: ctx.teamId,
        globalDefaults,
        templateVariables,
      })

      // Criar EmailLog para cada email enviado com mapeamento explícito email→resendId
      if (dispatchResult.dispatched.length > 0) {
        const now = new Date()
        const emailToContact = new Map(recipientsList.map((c) => [c.email, c]))
        await prisma.emailLog.createMany({
          data: dispatchResult.dispatched.map(({ email, resendId }) => ({
            id: randomUUID(),
            teamId: ctx.teamId,
            campaignId: campaign.id,
            resendEmailId: resendId,
            recipientEmail: email,
            recipientName: emailToContact.get(email)?.name ?? null,
            subject: campaign.template.subject,
            status: "sent" as const,
            sentAt: now,
          })),
          skipDuplicates: true,
        })

        if (hasCredits) {
          await this.creditService.deductCredits(masterId, dispatchResult.sent)
        }
      }

      await prisma.emailCampaign.update({
        where: { id },
        data: {
          status: "sent",
          sentAt: new Date(),
          totalRecipients: recipientsList.length,
          totalSent: dispatchResult.sent,
          dispatchCount: { increment: 1 },
        },
      })

      return new Output(
        true,
        [`Campanha disparada: ${dispatchResult.sent} emails enviados`],
        dispatchResult.failed > 0 ? [`${dispatchResult.failed} emails falharam`] : [],
        { sent: dispatchResult.sent, failed: dispatchResult.failed }
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
