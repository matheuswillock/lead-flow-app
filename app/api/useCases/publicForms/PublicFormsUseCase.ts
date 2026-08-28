import type { Prisma } from "@prisma/client"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  buildPublicFormPreviewSnapshot,
  mapPublicFormDraft,
  publicFormsService,
} from "@/app/api/services/PublicForms/PublicFormsService"
import { withPrismaRetry } from "@/app/api/infra/data/prisma"
import { Output } from "@/lib/output"
import type {
  PublicFormDraftInput,
  PublicFormListFilters,
  PublicFormMetricEventInput,
} from "@/lib/public-forms/types"
import { rankTopFormsByConversion } from "@/lib/public-forms/form-ranking"
import { validatePublicFormDraft } from "@/lib/public-forms/validate-public-form-draft"
import { isValidPublicFormId } from "@/lib/public-forms/validation"
import {
  buildPublicFormMetricQueuePayload,
  publishPublicFormMetricEvent,
  PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG,
} from "@/lib/queues/public-form-metric-events"
import { publishWithRetry } from "@/lib/queues/publish-with-retry"
import {
  formatProcessingError,
  publicFormQueueEventFailureRepository,
} from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/PublicFormQueueEventFailureRepository"

function isManager(access: TeamAccess) {
  return access.isMaster || access.teamMember.role === "manager"
}

async function canApprove(access: TeamAccess) {
  if (access.isMaster) return true
  const settings = await publicFormsService.getSettings(access.teamId)
  return settings.approverRoles.includes(access.teamMember.role)
}

function publicationErrors(form: Awaited<ReturnType<typeof publicFormsService.get>>) {
  if (!form) return ["Formulário não encontrado"]
  return validatePublicFormDraft(mapPublicFormDraft(form), { mode: "form" })
}

export class PublicFormsUseCase {
  async list(access: TeamAccess, filters: PublicFormListFilters) {
    const approvalPermission = await canApprove(access)
    if (!isManager(access) && !approvalPermission) {
      return new Output(false, [], ["Acesso negado aos formulários"], null)
    }
    const result = await publicFormsService.list(access.teamId, filters)
    return new Output(true, [], [], {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        managedByCorretorStudio: Boolean(item.managedByBackofficeUserId),
        managedByBackofficeUserId: undefined,
      })),
      capabilities: { canEdit: isManager(access), canApprove: approvalPermission },
    })
  }

  async listPublishedOptions(access: TeamAccess) {
    return new Output(true, [], [], await publicFormsService.listPublishedOptions(access.teamId))
  }

  async listTemplates(access: TeamAccess) {
    if (!isManager(access) && !(await canApprove(access))) {
      return new Output(false, [], ["Acesso negado aos formulários"], null)
    }
    return new Output(true, [], [], await publicFormsService.listTemplates(access.teamId))
  }

  async getTemplate(access: TeamAccess, slug: string) {
    if (!isManager(access) && !(await canApprove(access))) {
      return new Output(false, [], ["Acesso negado aos formulários"], null)
    }
    const template = await publicFormsService.getTemplate(access.teamId, slug)
    if (!template) return new Output(false, [], ["Template não encontrado"], null)
    return new Output(true, [], [], template)
  }

  async get(access: TeamAccess, id: string) {
    const approvalPermission = await canApprove(access)
    if (!isManager(access) && !approvalPermission) {
      return new Output(false, [], ["Acesso negado aos formulários"], null)
    }
    const form = await publicFormsService.get(access.teamId, id)
    if (!form) return new Output(false, [], ["Formulário não encontrado"], null)
    const { managedByBackofficeUserId, ...rest } = form
    return new Output(true, [], [], {
      ...rest,
      managedByCorretorStudio: Boolean(managedByBackofficeUserId),
      capabilities: { canEdit: isManager(access), canApprove: approvalPermission },
    })
  }

  async create(access: TeamAccess, input: PublicFormDraftInput) {
    if (!isManager(access)) return new Output(false, [], ["Acesso negado"], null)
    try {
      const form = await publicFormsService.create(access.teamId, access.profileId, input)
      return new Output(true, ["Formulário criado"], [], form)
    } catch (error) {
      return new Output(false, [], [error instanceof Error ? error.message : "Dados inválidos"], null)
    }
  }

  async update(access: TeamAccess, id: string, input: PublicFormDraftInput) {
    if (!isManager(access)) return new Output(false, [], ["Acesso negado"], null)
    try {
      const form = await publicFormsService.update(access.teamId, id, input)
      return form
        ? new Output(true, ["Rascunho salvo"], [], form)
        : new Output(false, [], ["Formulário não encontrado"], null)
    } catch (error) {
      return new Output(false, [], [error instanceof Error ? error.message : "Dados inválidos"], null)
    }
  }

  async duplicate(access: TeamAccess, id: string) {
    if (!isManager(access)) return new Output(false, [], ["Acesso negado"], null)
    const form = await publicFormsService.duplicate(access.teamId, id, access.profileId)
    return form
      ? new Output(true, ["Formulário duplicado"], [], form)
      : new Output(false, [], ["Formulário não encontrado"], null)
  }

  async submitApproval(access: TeamAccess, id: string) {
    if (!isManager(access)) return new Output(false, [], ["Acesso negado"], null)
    const form = await publicFormsService.get(access.teamId, id)
    const errors = publicationErrors(form)
    if (errors.length > 0) return new Output(false, [], errors, null)
    const result = await publicFormsService.transition(access.teamId, id, {
      approvalStatus: "pending_approval",
      reviewComment: null,
    })
    return new Output(true, ["Formulário enviado para aprovação"], [], result)
  }

  async approve(access: TeamAccess, id: string) {
    if (!(await canApprove(access))) return new Output(false, [], ["Acesso negado"], null)
    const form = await publicFormsService.get(access.teamId, id)
    if (!form || form.approvalStatus !== "pending_approval") {
      return new Output(false, [], ["Formulário não está aguardando aprovação"], null)
    }
    const errors = publicationErrors(form)
    if (errors.length > 0) return new Output(false, [], errors, null)
    const result = await publicFormsService.transition(access.teamId, id, {
      approvalStatus: "approved",
      reviewedById: access.profileId,
      reviewComment: null,
    })
    return new Output(true, ["Formulário aprovado"], [], result)
  }

  async reject(access: TeamAccess, id: string, comment: string) {
    if (!(await canApprove(access))) return new Output(false, [], ["Acesso negado"], null)
    if (!comment.trim()) return new Output(false, [], ["Informe o motivo da reprovação"], null)
    const result = await publicFormsService.transition(access.teamId, id, {
      status: "draft",
      approvalStatus: "rejected",
      reviewedById: access.profileId,
      reviewComment: comment.trim(),
    })
    return result
      ? new Output(true, ["Formulário reprovado"], [], result)
      : new Output(false, [], ["Formulário não encontrado"], null)
  }

  async publish(access: TeamAccess, id: string) {
    if (!isManager(access) && !(await canApprove(access))) {
      return new Output(false, [], ["Acesso negado"], null)
    }
    const form = await publicFormsService.get(access.teamId, id)
    const errors = publicationErrors(form)
    if (errors.length > 0) return new Output(false, [], errors, null)
    const settings = await publicFormsService.getSettings(access.teamId)
    if (settings.approvalRequired && form?.approvalStatus !== "approved") {
      if (await canApprove(access)) {
        await publicFormsService.transition(access.teamId, id, {
          approvalStatus: "approved",
          reviewedById: access.profileId,
        })
      } else {
        return this.submitApproval(access, id)
      }
    }
    const publication = await publicFormsService.publish(access.teamId, id, access.profileId)
    return new Output(true, ["Formulário publicado"], [], publication)
  }

  async archive(access: TeamAccess, id: string) {
    if (!isManager(access)) return new Output(false, [], ["Acesso negado"], null)
    const form = await publicFormsService.transition(access.teamId, id, { status: "archived" })
    return form
      ? new Output(true, ["Formulário arquivado"], [], form)
      : new Output(false, [], ["Formulário não encontrado"], null)
  }

  async restore(access: TeamAccess, id: string) {
    if (!isManager(access)) return new Output(false, [], ["Acesso negado"], null)
    const form = await publicFormsService.transition(access.teamId, id, {
      status: "draft",
      approvalStatus: "draft",
      reviewComment: null,
    })
    return form
      ? new Output(true, ["Formulário restaurado como rascunho"], [], form)
      : new Output(false, [], ["Formulário não encontrado"], null)
  }

  async getSettings(access: TeamAccess) {
    if (!isManager(access)) return new Output(false, [], ["Acesso negado"], null)
    return new Output(true, [], [], await publicFormsService.getSettings(access.teamId))
  }

  async updateSettings(
    access: TeamAccess,
    input: Parameters<typeof publicFormsService.updateSettings>[1],
  ) {
    if (!isManager(access)) return new Output(false, [], ["Acesso negado"], null)
    return new Output(
      true,
      ["Configurações salvas"],
      [],
      await publicFormsService.updateSettings(access.teamId, input),
    )
  }

  async getPublic(publicId: string) {
    if (!isValidPublicFormId(publicId)) return new Output(false, [], ["Formulário indisponível"], null)
    const result = await publicFormsService.getPublic(publicId)
    return result
      ? new Output(true, [], [], result)
      : new Output(false, [], ["Formulário indisponível"], null)
  }

  async getAvailabilityContext(publicId: string) {
    if (!isValidPublicFormId(publicId)) return new Output(false, [], ["Formulário indisponível"], null)
    const result = await publicFormsService.getAvailabilityContext(publicId)
    return result
      ? new Output(true, [], [], result)
      : new Output(false, [], ["Formulário indisponível"], null)
  }

  /**
   * PR2.3: todo eventType (antes só os críticos de funil) publica direto na
   * fila `public-form-metric-events` — sem Prisma no caminho feliz. Se as 3
   * tentativas de publish (publish-with-retry) esgotarem, cai no outbox
   * compartilhado (`PublicFormQueueEventFailure`, kind=metric) em vez de só
   * logar e perder o evento.
   */
  async recordMetric(publicId: string, input: PublicFormMetricEventInput) {
    if (!isValidPublicFormId(publicId)) {
      return new Output(false, [], ["Formulário indisponível"], null)
    }

    const payload = buildPublicFormMetricQueuePayload(publicId, {
      ...input,
      eventType: input.eventType,
      createCrmLead: false,
    })

    const publishResult = await publishWithRetry(() => publishPublicFormMetricEvent(payload))
    if (publishResult.ok) {
      console.info("[PublicFormsUseCase][recordMetric] queued metric", {
        publicId,
        eventType: input.eventType,
        eventKey: input.eventKey,
        messageId: publishResult.result.messageId,
      })
      return new Output(true, [], [], { queued: true, messageId: publishResult.result.messageId })
    }

    console.error(
      `[PublicFormsUseCase][recordMetric] ${PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG}`,
      {
        tag: PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG,
        publicId,
        eventType: input.eventType,
        eventKey: input.eventKey,
        attempts: publishResult.attempts,
        error: publishResult.error,
      },
    )
    try {
      await publicFormQueueEventFailureRepository.upsertFromProcessingFailure({
        kind: "metric",
        idempotencyKey: input.eventKey,
        payload: payload as unknown as Prisma.InputJsonValue,
        lastError: formatProcessingError(publishResult.error),
        failureReason: "queue_publish_failed",
        eventId: payload.eventId,
        schemaVersion: payload.schemaVersion,
        topic: "public-form-metric-events",
        failureStage: "publisher_outbox",
      })
      return new Output(true, [], [], { queued: false, fallback: true })
    } catch (outboxError) {
      console.error("[PublicFormsUseCase][recordMetric][outbox]", outboxError)
      return new Output(false, [], ["Falha ao enfileirar evento de métrica"], {
        code: PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG,
      })
    }
  }

  /**
   * Persistência idempotente usada pelo consumer da Vercel Queue.
   * Persiste e aguarda o espelho Radar no mesmo isolate (sem `after()`).
   * Erros transitórios (Prisma ou Radar) propagam para o retry do `handleCallback`.
   */
  async persistQueuedMetric(publicId: string, input: PublicFormMetricEventInput): Promise<boolean> {
    if (!isValidPublicFormId(publicId)) return false
    return withPrismaRetry(
      () => publicFormsService.recordMetric(publicId, input, { radarMode: "inline" }),
      { retries: 1, label: "publicForms.persistQueuedMetric" },
    )
  }

  async analytics(access: TeamAccess, id: string, from?: Date, to?: Date, publicationId?: string) {
    if (!isManager(access) && !(await canApprove(access))) {
      return new Output(false, [], ["Acesso negado"], null)
    }
    const result = await publicFormsService.analytics(access.teamId, id, from, to, publicationId)
    return result
      ? new Output(true, [], [], result)
      : new Output(false, [], ["Formulário não encontrado"], null)
  }

  async topConverting(access: TeamAccess, from?: Date, to?: Date) {
    try {
      if (!isManager(access) && !(await canApprove(access))) {
        return new Output(false, [], ["Acesso negado"], null)
      }
      const rows = await publicFormsService.listFormConversionTotals(access.teamId, { from, to })
      return new Output(true, [], [], {
        period: { from: from ?? null, to: to ?? null },
        items: rankTopFormsByConversion(rows),
      })
    } catch (error) {
      console.error("[PublicFormsUseCase][topConverting]", error)
      return new Output(false, [], ["Erro ao carregar ranking de formulários"], null)
    }
  }

  async leadSubmissions(access: TeamAccess, leadId: string) {
    return new Output(
      true,
      [],
      [],
      await publicFormsService.listLeadSubmissions(access.teamId, leadId),
    )
  }

  async preview(access: TeamAccess, id: string) {
    const approvalPermission = await canApprove(access)
    if (!isManager(access) && !approvalPermission) {
      return new Output(false, [], ["Acesso negado aos formulários"], null)
    }
    const form = await publicFormsService.get(access.teamId, id)
    if (!form) return new Output(false, [], ["Formulário não encontrado"], null)
    return new Output(true, [], [], { snapshot: buildPublicFormPreviewSnapshot(form) })
  }
}

export const publicFormsUseCase = new PublicFormsUseCase()
