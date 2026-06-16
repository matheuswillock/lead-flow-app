import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { isManagerLikeRole } from "@/lib/roles"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"

const templateDetailSelect = {
  id: true,
  teamId: true,
  createdBy: true,
  name: true,
  subject: true,
  previewText: true,
  mailyJson: true,
  html: true,
  variables: true,
  status: true,
  publishedAt: true,
  isArchived: true,
  approvalStatus: true,
  approvedBy: true,
  approvedAt: true,
  rejectedBy: true,
  rejectedAt: true,
  reviewNote: true,
  createdAt: true,
  updatedAt: true,
} as const

export type TemplateApprovalFilter = "pending_approval" | "approved" | "rejected" | "all"

export interface TemplateVariableInput {
  key: string
  type?: "string" | "number"
  fallbackValue?: string | null
}

export interface CreateTemplateInput {
  name: string
  subject: string
  previewText?: string
  mailyJson?: unknown
  html?: string
  variables?: TemplateVariableInput[]
}

export interface UpdateTemplateInput {
  name?: string
  subject?: string
  previewText?: string
  mailyJson?: unknown
  html?: string
  variables?: TemplateVariableInput[]
}

export class EmailTemplateUseCase {
  async list(ctx: TeamContext, approvalFilter: TemplateApprovalFilter = "all"): Promise<Output> {
    try {
      const approvalWhere =
        approvalFilter === "all" ? undefined : { approvalStatus: approvalFilter }

      const templates = await prisma.emailTemplate.findMany({
        where: { teamId: ctx.teamId, isArchived: false, ...approvalWhere },
        select: {
          id: true,
          name: true,
          subject: true,
          previewText: true,
          mailyJson: true,
          html: true,
          variables: true,
          status: true,
          publishedAt: true,
          approvalStatus: true,
          createdAt: true,
          updatedAt: true,
          creator: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
      })

      return new Output(true, [], [], templates)
    } catch (error) {
      console.error("[EmailTemplateUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar templates de email"], null)
    }
  }

  async getById(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const template = await prisma.emailTemplate.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false },
        select: templateDetailSelect,
      })

      if (!template) {
        return new Output(false, [], ["Template não encontrado"], null)
      }

      return new Output(true, [], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][getById]", error)
      return new Output(false, [], ["Erro ao buscar template de email"], null)
    }
  }

  async create(data: CreateTemplateInput, ctx: TeamContext): Promise<Output> {
    try {
      if (!data.name?.trim()) {
        return new Output(false, [], ["Nome do template é obrigatório"], null)
      }
      if (!data.subject?.trim()) {
        return new Output(false, [], ["Assunto do template é obrigatório"], null)
      }

      const teamSettings = await prisma.emailTeamSettings.findUnique({
        where: { teamId: ctx.teamId },
        select: { templateCreateRoles: true, templateApprovalRequired: true },
      }).catch(() => null)

      const createRoles = teamSettings?.templateCreateRoles ?? ["manager", "backoffice"]
      if (!createRoles.includes(ctx.teamMember.role)) {
        return new Output(false, [], ["Seu perfil não tem permissão para criar templates"], null)
      }

      const requiresApproval = teamSettings?.templateApprovalRequired ?? false
      const isManager = isManagerLikeRole(ctx.teamMember.role)
      const approvalStatus = requiresApproval && !isManager ? "pending_approval" : "approved"

      const template = await prisma.emailTemplate.create({
        select: templateDetailSelect,
        data: {
          id: randomUUID(),
          teamId: ctx.teamId,
          createdBy: ctx.profileId,
          name: data.name.trim(),
          subject: data.subject.trim(),
          previewText: data.previewText?.trim() ?? null,
          mailyJson: (data.mailyJson as object) ?? null,
          html: data.html ?? null,
          variables: (data.variables as object) ?? undefined,
          approvalStatus,
        },
      })

      const message =
        approvalStatus === "pending_approval"
          ? "Template criado e enviado para aprovação"
          : "Template criado com sucesso"

      return new Output(true, [message], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar template de email"], null)
    }
  }

  async update(id: string, data: UpdateTemplateInput, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailTemplate.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false },
        select: { id: true },
      })

      if (!existing) {
        return new Output(false, [], ["Template não encontrado"], null)
      }

      const template = await prisma.emailTemplate.update({
        where: { id },
        select: templateDetailSelect,
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.subject !== undefined && { subject: data.subject.trim() }),
          ...(data.previewText !== undefined && { previewText: data.previewText?.trim() ?? null }),
          ...(data.mailyJson !== undefined && { mailyJson: data.mailyJson as object }),
          ...(data.html !== undefined && { html: data.html }),
          ...(data.variables !== undefined && { variables: (data.variables as object) ?? Prisma.JsonNull }),
        },
      })

      return new Output(true, ["Template atualizado com sucesso"], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar template de email"], null)
    }
  }

  async approve(id: string, ctx: TeamContext): Promise<Output> {
    try {
      if (!isManagerLikeRole(ctx.teamMember.role)) {
        return new Output(false, [], ["Apenas managers podem aprovar templates"], null)
      }

      const existing = await prisma.emailTemplate.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false, approvalStatus: "pending_approval" },
        select: { id: true },
      })

      if (!existing) {
        return new Output(false, [], ["Template pendente de aprovação não encontrado"], null)
      }

      const template = await prisma.emailTemplate.update({
        where: { id },
        select: templateDetailSelect,
        data: {
          approvalStatus: "approved",
          approvedBy: ctx.profileId,
          approvedAt: new Date(),
          rejectedBy: null,
          rejectedAt: null,
          reviewNote: null,
        },
      })

      return new Output(true, ["Template aprovado com sucesso"], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][approve]", error)
      return new Output(false, [], ["Erro ao aprovar template"], null)
    }
  }

  async reject(id: string, reviewNote: string, ctx: TeamContext): Promise<Output> {
    try {
      if (!isManagerLikeRole(ctx.teamMember.role)) {
        return new Output(false, [], ["Apenas managers podem rejeitar templates"], null)
      }
      if (!reviewNote?.trim()) {
        return new Output(false, [], ["Motivo de rejeição é obrigatório"], null)
      }

      const existing = await prisma.emailTemplate.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false, approvalStatus: "pending_approval" },
        select: { id: true },
      })

      if (!existing) {
        return new Output(false, [], ["Template pendente de aprovação não encontrado"], null)
      }

      const template = await prisma.emailTemplate.update({
        where: { id },
        select: templateDetailSelect,
        data: {
          approvalStatus: "rejected",
          rejectedBy: ctx.profileId,
          rejectedAt: new Date(),
          approvedBy: null,
          approvedAt: null,
          reviewNote: reviewNote.trim(),
        },
      })

      return new Output(true, ["Template rejeitado"], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][reject]", error)
      return new Output(false, [], ["Erro ao rejeitar template"], null)
    }
  }

  async submitForApproval(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailTemplate.findFirst({
        where: {
          id,
          teamId: ctx.teamId,
          isArchived: false,
          status: "draft",
          approvalStatus: { in: ["approved", "rejected"] },
        },
        select: { id: true },
      })

      if (!existing) {
        return new Output(false, [], ["Template não encontrado ou não pode ser submetido para aprovação"], null)
      }

      const template = await prisma.emailTemplate.update({
        where: { id },
        select: templateDetailSelect,
        data: { approvalStatus: "pending_approval" },
      })

      return new Output(true, ["Template enviado para aprovação"], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][submitForApproval]", error)
      return new Output(false, [], ["Erro ao enviar template para aprovação"], null)
    }
  }

  async publish(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailTemplate.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false },
        select: { id: true, html: true, approvalStatus: true },
      })

      if (!existing) {
        return new Output(false, [], ["Template não encontrado"], null)
      }
      if (!existing.html?.trim()) {
        return new Output(false, [], ["Template não possui HTML. Edite o conteúdo antes de publicar"], null)
      }
      if (existing.approvalStatus !== "approved") {
        return new Output(false, [], ["Template precisa estar aprovado antes de ser publicado"], null)
      }

      const template = await prisma.emailTemplate.update({
        where: { id },
        select: templateDetailSelect,
        data: { status: "published", publishedAt: new Date() },
      })

      return new Output(true, ["Template publicado com sucesso"], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][publish]", error)
      return new Output(false, [], ["Erro ao publicar template"], null)
    }
  }

  async unpublish(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailTemplate.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false },
        select: { id: true },
      })

      if (!existing) {
        return new Output(false, [], ["Template não encontrado"], null)
      }

      const template = await prisma.emailTemplate.update({
        where: { id },
        select: templateDetailSelect,
        data: { status: "draft", publishedAt: null },
      })

      return new Output(true, ["Template movido para rascunho"], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][unpublish]", error)
      return new Output(false, [], ["Erro ao despublicar template"], null)
    }
  }

  async archive(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailTemplate.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false },
        select: { id: true },
      })

      if (!existing) {
        return new Output(false, [], ["Template não encontrado"], null)
      }

      await prisma.emailTemplate.update({
        where: { id },
        select: { id: true },
        data: { isArchived: true },
      })

      return new Output(true, ["Template removido com sucesso"], [], null)
    } catch (error) {
      console.error("[EmailTemplateUseCase][archive]", error)
      return new Output(false, [], ["Erro ao remover template de email"], null)
    }
  }
}
