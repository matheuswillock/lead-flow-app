import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
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
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} as const

export interface CreateTemplateInput {
  name: string
  subject: string
  previewText?: string
  mailyJson?: unknown
  html?: string
}

export interface UpdateTemplateInput {
  name?: string
  subject?: string
  previewText?: string
  mailyJson?: unknown
  html?: string
}

export class EmailTemplateUseCase {
  async list(ctx: TeamContext): Promise<Output> {
    try {
      const templates = await prisma.emailTemplate.findMany({
        where: { teamId: ctx.teamId, isArchived: false },
        select: {
          id: true,
          name: true,
          subject: true,
          previewText: true,
          mailyJson: true,
          html: true,
          createdAt: true,
          updatedAt: true,
          creator: { select: { id: true, fullName: true } },
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
        },
      })

      return new Output(true, ["Template criado com sucesso"], [], template)
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
        },
      })

      return new Output(true, ["Template atualizado com sucesso"], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][update]", error)
      return new Output(false, [], ["Erro ao atualizar template de email"], null)
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
