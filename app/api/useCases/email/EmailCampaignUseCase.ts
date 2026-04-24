import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { EmailCampaignDispatchService } from "@/app/api/services/EmailCampaignDispatch/EmailCampaignDispatchService"
import { EmailCreditService } from "@/app/api/services/EmailCredit/EmailCreditService"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"

const DEFAULT_FROM = `Corretor Studio <no-reply@corretorstudio.com>`

export interface CreateCampaignInput {
  name: string
  templateId: string
  contactListId: string
  scheduledAt?: string | null
}

export class EmailCampaignUseCase {
  private dispatchService = new EmailCampaignDispatchService()
  private creditService = new EmailCreditService()

  async list(ctx: TeamContext, options: { status?: string; page: number; pageSize: number }): Promise<Output> {
    try {
      const where = {
        teamId: ctx.teamId,
        ...(options.status && { status: options.status as never }),
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
            createdAt: true,
            template: { select: { id: true, name: true } },
            contactList: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (options.page - 1) * options.pageSize,
          take: options.pageSize,
        }),
        prisma.emailCampaign.count({ where }),
      ])

      return new Output(true, [], [], {
        campaigns,
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
        prisma.emailTemplate.findFirst({ where: { id: data.templateId, teamId: ctx.teamId, isArchived: false } }),
        prisma.emailContactList.findFirst({ where: { id: data.contactListId, teamId: ctx.teamId, isArchived: false } }),
      ])

      if (!template) {
        return new Output(false, [], ["Template não encontrado ou não pertence ao time"], null)
      }
      if (!contactList) {
        return new Output(false, [], ["Lista de contatos não encontrada ou não pertence ao time"], null)
      }

      const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null
      if (scheduledAt && scheduledAt <= new Date()) {
        return new Output(false, [], ["Data de agendamento deve ser no futuro"], null)
      }

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
          totalRecipients: contactList.totalContacts,
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

      const campaign = await prisma.emailCampaign.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.templateId !== undefined && { templateId: data.templateId }),
          ...(data.contactListId !== undefined && { contactListId: data.contactListId }),
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
          template: true,
          contactList: { select: { id: true, name: true, totalContacts: true } },
          team: { select: { master: { select: { id: true } } } },
        },
      })

      if (!campaign) {
        return new Output(false, [], ["Campanha não encontrada ou já foi enviada"], null)
      }

      if (!campaign.template.html) {
        return new Output(false, [], ["Template não possui HTML. Edite o template antes de disparar"], null)
      }

      const masterId = campaign.team.master.id
      const hasCredits = await this.creditService.hasEnoughCredits(masterId)
      if (!hasCredits) {
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
      const contacts = await prisma.emailContact.findMany({
        where: { listId: campaign.contactListId, isUnsubscribed: false, isBounced: false },
        select: { email: true, name: true, customFields: true },
      })

      if (contacts.length === 0) {
        await prisma.emailCampaign.update({
          where: { id },
          data: { status: "failed", errorMessage: "Nenhum contato ativo na lista" },
        })
        return new Output(false, [], ["Nenhum contato ativo na lista para envio"], null)
      }

      const recipientsList = contacts.map((contact) => ({
        email: contact.email,
        name: contact.name ?? undefined,
        customFields:
          contact.customFields && typeof contact.customFields === "object"
            ? (contact.customFields as Record<string, unknown>)
            : null,
      }))

      // Dispatch
      const dispatchResult = await this.dispatchService.dispatchBatch({
        from: DEFAULT_FROM,
        recipients: recipientsList,
        subject: campaign.template.subject,
        html: campaign.template.html,
        campaignId: campaign.id,
        teamId: ctx.teamId,
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

        // Deduzir créditos
        await this.creditService.deductCredits(masterId, dispatchResult.sent)
      }

      await prisma.emailCampaign.update({
        where: { id },
        data: {
          status: "sent",
          sentAt: new Date(),
          totalSent: dispatchResult.sent,
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
