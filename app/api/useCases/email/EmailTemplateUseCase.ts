import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { isManagerLikeRole } from "@/lib/roles"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"
import { EmailTeamVariablesUseCase } from "./EmailTeamVariablesUseCase"
import { assertResend, buildResendIdempotencyKey } from "@/lib/email"
import {
  type EmailTemplateFunctionDefinition,
  type EmailTemplateVariableKind,
  extractTemplateVariableKeys,
  interpolateEmailTemplate,
} from "@/lib/email/interpolate"

const templateDetailSelect = {
  id: true,
  teamId: true,
  createdBy: true,
  versionGroupId: true,
  versionNumber: true,
  isCurrentPublished: true,
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
  history: {
    select: {
      id: true,
      eventType: true,
      description: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  },
} as const

export type TemplateApprovalFilter = "pending_approval" | "approved" | "rejected" | "all"
export type TemplateListScope = "workbench" | "campaign"

export interface TemplateVariableInput {
  key: string
  kind?: EmailTemplateVariableKind
  type?: "string" | "number"
  fallbackValue?: string | null
  reviewStatus?: "pending" | "reviewed"
  definition?: EmailTemplateFunctionDefinition | null
}

export interface TemplateTestVariableInput {
  key: string
  kind?: EmailTemplateVariableKind
  type?: "string" | "number"
  fallbackValue?: string | null
  reviewStatus?: "pending" | "reviewed"
  definition?: EmailTemplateFunctionDefinition | null
  value?: string
}

export interface TemplateTestInput {
  to: string
  subject: string
  html: string
  variables?: TemplateTestVariableInput[]
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

function resolveTemplateApprovalSeed(
  requiresApproval: boolean,
  isManager: boolean,
  profileId: string
): {
  approvalStatus: "pending_approval" | "approved"
  approvedBy: string | null
  approvedAt: Date | null
} {
  if (requiresApproval && !isManager) {
    return {
      approvalStatus: "pending_approval",
      approvedBy: null,
      approvedAt: null,
    }
  }

  if (requiresApproval && isManager) {
    return {
      approvalStatus: "approved",
      approvedBy: profileId,
      approvedAt: new Date(),
    }
  }

  return {
    approvalStatus: "approved",
    approvedBy: null,
    approvedAt: null,
  }
}

export class EmailTemplateUseCase {
  private async recordHistory(params: {
    templateId: string
    teamId: string
    actorProfileId: string
    eventType: string
    description: string
    metadata?: Prisma.InputJsonValue
  }) {
    await prisma.emailTemplateHistory.create({
      data: {
        id: randomUUID(),
        templateId: params.templateId,
        teamId: params.teamId,
        actorProfileId: params.actorProfileId,
        eventType: params.eventType,
        description: params.description,
        metadata: params.metadata ?? Prisma.JsonNull,
      },
      select: { id: true },
    })
  }

  async list(
    ctx: TeamContext,
    approvalFilter: TemplateApprovalFilter = "all",
    scope: TemplateListScope = "workbench"
  ): Promise<Output> {
    try {
      const approvalWhere =
        approvalFilter === "all" ? undefined : { approvalStatus: approvalFilter }

      const templates = await prisma.emailTemplate.findMany({
        where: {
          teamId: ctx.teamId,
          isArchived: false,
          ...(scope === "campaign" ? { status: "published", isCurrentPublished: true } : {}),
          ...approvalWhere,
        },
        select: {
          id: true,
          versionGroupId: true,
          versionNumber: true,
          isCurrentPublished: true,
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

      if (scope === "campaign") {
        return new Output(true, [], [], templates)
      }

      const latestByGroup = new Map<string, (typeof templates)[number]>()
      for (const template of templates) {
        const groupId = template.versionGroupId
        const current = latestByGroup.get(groupId)
        if (!current) {
          latestByGroup.set(groupId, template)
          continue
        }
        const templatePriority = template.status === "published" ? 0 : 1
        const currentPriority = current.status === "published" ? 0 : 1
        if (
          templatePriority > currentPriority ||
          (templatePriority === currentPriority && template.versionNumber > current.versionNumber)
        ) {
          latestByGroup.set(groupId, template)
        }
      }

      return new Output(true, [], [], Array.from(latestByGroup.values()))
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
      const approvalSeed = resolveTemplateApprovalSeed(requiresApproval, isManager, ctx.profileId)

      const templateId = randomUUID()
      const template = await prisma.emailTemplate.create({
        select: templateDetailSelect,
        data: {
          id: templateId,
          teamId: ctx.teamId,
          createdBy: ctx.profileId,
          versionGroupId: templateId,
          name: data.name.trim(),
          subject: data.subject.trim(),
          previewText: data.previewText?.trim() ?? null,
          mailyJson: (data.mailyJson as object) ?? null,
          html: data.html ?? null,
          variables: (data.variables as object) ?? undefined,
          approvalStatus: approvalSeed.approvalStatus,
          approvedBy: approvalSeed.approvedBy,
          approvedAt: approvalSeed.approvedAt,
        },
      })
      await this.recordHistory({
        templateId: template.id,
        teamId: ctx.teamId,
        actorProfileId: ctx.profileId,
        eventType: "created",
        description: "Template criado",
        metadata: { versionNumber: template.versionNumber },
      })
      const created = await prisma.emailTemplate.findUniqueOrThrow({
        where: { id: template.id },
        select: templateDetailSelect,
      })

      const message =
        approvalSeed.approvalStatus === "pending_approval"
          ? "Template criado e enviado para aprovação"
          : "Template criado com sucesso"

      return new Output(true, [message], [], created)
    } catch (error) {
      console.error("[EmailTemplateUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar template de email"], null)
    }
  }

  async update(id: string, data: UpdateTemplateInput, ctx: TeamContext): Promise<Output> {
    try {
      const existing = await prisma.emailTemplate.findFirst({
        where: { id, teamId: ctx.teamId, isArchived: false },
        select: {
          id: true,
          teamId: true,
          createdBy: true,
          versionGroupId: true,
          versionNumber: true,
          name: true,
          subject: true,
          previewText: true,
          mailyJson: true,
          html: true,
          variables: true,
          status: true,
          approvalStatus: true,
        },
      })

      if (!existing) {
        return new Output(false, [], ["Template não encontrado"], null)
      }

      const updateData = {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.subject !== undefined && { subject: data.subject.trim() }),
        ...(data.previewText !== undefined && { previewText: data.previewText?.trim() ?? null }),
        ...(data.mailyJson !== undefined && { mailyJson: data.mailyJson as object }),
        ...(data.html !== undefined && { html: data.html }),
        ...(data.variables !== undefined && { variables: (data.variables as object) ?? Prisma.JsonNull }),
      }

      if (existing.status === "published") {
        const existingDraft = await prisma.emailTemplate.findFirst({
          where: {
            teamId: ctx.teamId,
            versionGroupId: existing.versionGroupId,
            isArchived: false,
            status: "draft",
          },
          select: { id: true },
          orderBy: { versionNumber: "desc" },
        })

        if (existingDraft) {
          const template = await prisma.emailTemplate.update({
            where: { id: existingDraft.id },
            select: templateDetailSelect,
            data: updateData,
          })
          await this.recordHistory({
            templateId: template.id,
            teamId: ctx.teamId,
            actorProfileId: ctx.profileId,
            eventType: "draft_saved",
            description: "Rascunho salvo",
            metadata: { versionNumber: template.versionNumber, sourceTemplateId: existing.id },
          })
          return new Output(true, ["Nova versão atualizada com sucesso"], [], template)
        }

        const latestVersion = await prisma.emailTemplate.aggregate({
          where: { teamId: ctx.teamId, versionGroupId: existing.versionGroupId },
          _max: { versionNumber: true },
        })
        const teamSettings = await prisma.emailTeamSettings.findUnique({
          where: { teamId: ctx.teamId },
          select: { templateApprovalRequired: true },
        }).catch(() => null)
        const requiresApproval = teamSettings?.templateApprovalRequired ?? false
        const isManager = isManagerLikeRole(ctx.teamMember.role)
        const approvalSeed = resolveTemplateApprovalSeed(requiresApproval, isManager, ctx.profileId)
        const nextId = randomUUID()
        const template = await prisma.emailTemplate.create({
          select: templateDetailSelect,
          data: {
            id: nextId,
            teamId: ctx.teamId,
            createdBy: ctx.profileId,
            versionGroupId: existing.versionGroupId,
            versionNumber: (latestVersion._max.versionNumber ?? existing.versionNumber) + 1,
            isCurrentPublished: false,
            name: data.name?.trim() ?? existing.name,
            subject: data.subject?.trim() ?? existing.subject,
            previewText: data.previewText !== undefined ? data.previewText?.trim() ?? null : existing.previewText,
            mailyJson: data.mailyJson !== undefined ? data.mailyJson as object : existing.mailyJson ?? Prisma.JsonNull,
            html: data.html !== undefined ? data.html : existing.html,
            variables: data.variables !== undefined ? (data.variables as object) ?? Prisma.JsonNull : existing.variables ?? Prisma.JsonNull,
            status: "draft",
            publishedAt: null,
            approvalStatus: approvalSeed.approvalStatus,
            approvedBy: approvalSeed.approvedBy,
            approvedAt: approvalSeed.approvedAt,
            rejectedBy: null,
            rejectedAt: null,
            reviewNote: null,
          },
        })
        await this.recordHistory({
          templateId: template.id,
          teamId: ctx.teamId,
          actorProfileId: ctx.profileId,
          eventType: "version_created",
          description: `Versão ${template.versionNumber}.0 criada a partir da versão ${existing.versionNumber}.0`,
          metadata: { versionNumber: template.versionNumber, sourceTemplateId: existing.id },
        })
        return new Output(true, ["Nova versão criada com sucesso"], [], template)
      }

      const template = await prisma.emailTemplate.update({
        where: { id },
        select: templateDetailSelect,
        data: updateData,
      })
      await this.recordHistory({
        templateId: template.id,
        teamId: ctx.teamId,
        actorProfileId: ctx.profileId,
        eventType: "draft_saved",
        description: "Rascunho salvo",
        metadata: { versionNumber: template.versionNumber },
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
      await this.recordHistory({
        templateId: template.id,
        teamId: ctx.teamId,
        actorProfileId: ctx.profileId,
        eventType: "approved",
        description: "Template aprovado",
        metadata: { versionNumber: template.versionNumber },
      })

      return new Output(true, ["Template aprovado com sucesso"], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][approve]", error)
      return new Output(false, [], ["Erro ao aprovar template"], null)
    }
  }

  async sendTest(id: string, data: TemplateTestInput, ctx: TeamContext): Promise<Output> {
    try {
      if (!data.to?.trim()) {
        return new Output(false, [], ["E-mail de teste é obrigatório"], null)
      }
      if (!data.subject?.trim()) {
        return new Output(false, [], ["Assunto do teste é obrigatório"], null)
      }
      if (!data.html?.trim()) {
        return new Output(false, [], ["HTML do teste é obrigatório"], null)
      }

      const variableInputs = (data.variables ?? []).map((variable) => ({
        key: variable.key.trim(),
        kind: variable.kind ?? "variable",
        type: variable.type ?? "string",
        fallbackValue: variable.fallbackValue?.trim() ? variable.fallbackValue.trim() : null,
        reviewStatus: variable.reviewStatus ?? "reviewed",
        definition: variable.definition
          ? {
              operator: variable.definition.operator,
              arguments: variable.definition.arguments ?? [],
              separator: variable.definition.separator ?? null,
              timezone: variable.definition.timezone ?? null,
            }
          : null,
        value: variable.value ?? "",
      }))

      const recipientEmail = data.to.trim().toLowerCase()
      const recipient = {
        email: recipientEmail,
        name: recipientEmail.split("@")[0] || recipientEmail,
        customFields: variableInputs.reduce<Record<string, string>>((acc, variable) => {
          if (variable.kind === "function") return acc
          const value = variable.value.trim()
          if (value) {
            acc[variable.key] = value
          }
          return acc
        }, {}),
      }
      const defaultsUseCase = new EmailTeamVariablesUseCase()
      const defaultsOutput = await defaultsUseCase.getDefaultsMap(ctx)
      const globalDefaults = defaultsOutput.isValid
        ? { ...(defaultsOutput.result as Record<string, string>) }
        : {}

      const renderedSubject = interpolateEmailTemplate(data.subject, recipient, globalDefaults, variableInputs)
      const renderedHtml = interpolateEmailTemplate(data.html, recipient, globalDefaults, variableInputs)
      const unresolvedTokens = extractTemplateVariableKeys(`${renderedSubject}\n${renderedHtml}`).filter(
        (token) => !["nome", "nome_do_lead", "name", "email"].includes(token.toLowerCase())
      )

      if (unresolvedTokens.length > 0) {
        return new Output(
          false,
          [],
          [`Variáveis sem valor suficiente: ${unresolvedTokens.map((token) => `{{${token}}}`).join(", ")}`],
          null
        )
      }

      const requestId = randomUUID()

      const resend = assertResend()
      const { error } = await resend.emails.send(
        {
          from: "Corretor Studio <no-reply@corretorstudio.com>",
          to: recipientEmail,
          subject: renderedSubject,
          html: renderedHtml,
          tags: [
            { name: "templateId", value: id },
            { name: "purpose", value: "template-test" },
          ],
        },
        {
          idempotencyKey: buildResendIdempotencyKey("template-test", `${id}/${requestId}`),
        }
      )

      if (error) {
        console.error("[EmailTemplateUseCase][sendTest] Resend error", error)
        return new Output(false, [], [error.message ?? "Erro ao enviar e-mail de teste"], null)
      }

      return new Output(true, [`E-mail de teste enviado para ${recipientEmail}`], [], {
        to: recipientEmail,
        creditsConsumed: 0,
      })
    } catch (error) {
      console.error("[EmailTemplateUseCase][sendTest]", error)
      return new Output(false, [], ["Erro ao enviar e-mail de teste"], null)
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
      await this.recordHistory({
        templateId: template.id,
        teamId: ctx.teamId,
        actorProfileId: ctx.profileId,
        eventType: "rejected",
        description: reviewNote.trim(),
        metadata: { versionNumber: template.versionNumber },
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
      await this.recordHistory({
        templateId: template.id,
        teamId: ctx.teamId,
        actorProfileId: ctx.profileId,
        eventType: "submitted_for_approval",
        description: "Template enviado para aprovação",
        metadata: { versionNumber: template.versionNumber },
      })

      return new Output(true, ["Template enviado para aprovação"], [], template)
    } catch (error) {
      console.error("[EmailTemplateUseCase][submitForApproval]", error)
      return new Output(false, [], ["Erro ao enviar template para aprovação"], null)
    }
  }

  async publish(id: string, ctx: TeamContext): Promise<Output> {
    try {
      const [existing, teamSettings] = await Promise.all([
        prisma.emailTemplate.findFirst({
          where: { id, teamId: ctx.teamId, isArchived: false },
          select: { id: true, html: true, approvalStatus: true, approvedAt: true, versionGroupId: true },
        }),
        prisma.emailTeamSettings.findUnique({
          where: { teamId: ctx.teamId },
          select: { templateApprovalRequired: true },
        }).catch(() => null),
      ])

      if (!existing) {
        return new Output(false, [], ["Template não encontrado"], null)
      }
      if (!existing.html?.trim()) {
        return new Output(false, [], ["Template não possui HTML. Edite o conteúdo antes de publicar"], null)
      }
      if (existing.approvalStatus !== "approved") {
        return new Output(false, [], ["Template precisa estar aprovado antes de ser publicado"], null)
      }

      const requiresApproval = teamSettings?.templateApprovalRequired ?? false
      if (requiresApproval && !existing.approvedAt) {
        return new Output(
          false,
          [],
          ["Template precisa passar por aprovação antes de ser publicado"],
          null
        )
      }

      const template = await prisma.$transaction(async (tx) => {
        await tx.emailTemplate.updateMany({
          where: { versionGroupId: existing.versionGroupId, isCurrentPublished: true },
          data: { isCurrentPublished: false },
        })
        return tx.emailTemplate.update({
          where: { id },
          select: templateDetailSelect,
          data: { status: "published", publishedAt: new Date(), isCurrentPublished: true },
        })
      })
      await this.recordHistory({
        templateId: template.id,
        teamId: ctx.teamId,
        actorProfileId: ctx.profileId,
        eventType: "published",
        description: "Template publicado",
        metadata: { versionNumber: template.versionNumber },
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
        data: { status: "draft", publishedAt: null, isCurrentPublished: false },
      })
      await this.recordHistory({
        templateId: template.id,
        teamId: ctx.teamId,
        actorProfileId: ctx.profileId,
        eventType: "unpublished",
        description: "Template despublicado",
        metadata: { versionNumber: template.versionNumber },
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
