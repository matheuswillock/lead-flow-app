import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  buildPublicFormPreviewSnapshot,
  mapPublicFormDraft,
  publicFormsService,
} from "@/app/api/services/PublicForms/PublicFormsService"
import { Output } from "@/lib/output"
import type {
  PublicFormDraftInput,
  PublicFormListFilters,
  PublicFormMetricEventInput,
} from "@/lib/public-forms/types"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "@/lib/public-forms/types"
import { getPageKey } from "@/lib/public-forms/pages"
import { rankTopFormsByConversion } from "@/lib/public-forms/form-ranking"

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
  const errors: string[] = []
  const draft = mapPublicFormDraft(form)
  if (!draft.name.trim()) errors.push("Informe o nome do formulário")
  if (draft.questions.length === 0) errors.push("Adicione pelo menos uma pergunta")
  const nameQuestion = draft.questions.find(
    (question) => question.mappingTarget === "native_field" && question.mappingKey === "name",
  )
  if (!nameQuestion) {
    errors.push("Mapeie uma pergunta para o campo obrigatório Nome")
  } else {
    if (!nameQuestion.required) errors.push("A pergunta mapeada para Nome deve ser obrigatória")
    if (draft.rules.some((rule) => rule.targetQuestionId === nameQuestion.id)) {
      errors.push("A pergunta mapeada para Nome não pode ser condicional")
    }
  }
  if (draft.schedulingEnabled && draft.eligibleCloserIds.length === 0) {
    errors.push("Selecione ao menos um closer para o agendamento")
  }
  const schedulingQuestions = draft.questions.filter((question) => question.type === "scheduling")
  if (draft.schedulingEnabled && schedulingQuestions.length !== 1) {
    errors.push("O formulário deve ter uma pergunta de agendamento")
  }
  if (!draft.schedulingEnabled && schedulingQuestions.length > 0) {
    errors.push("Ative a agenda ou remova a pergunta de agendamento")
  }
  const calculationQuestions = draft.questions.filter((question) => question.type === "calculation")
  if (calculationQuestions.length > 1) {
    errors.push("Só é permitido uma pergunta de cálculo por formulário")
  }
  for (const question of calculationQuestions) {
    const pageKey = getPageKey(question)
    const siblings = draft.questions.filter(
      (item) => item.id !== question.id && getPageKey(item) === pageKey,
    )
    if (siblings.length > 0) {
      errors.push("A pergunta de cálculo deve ficar sozinha na página")
      break
    }
  }
  const bands = [...draft.scoreBands].sort((a, b) => a.minScore - b.minScore)
  const questionIds = new Set(
    draft.questions.map((question) => question.id).filter((id): id is string => Boolean(id)),
  )
  for (const question of draft.questions) {
    if (
      question.mappingTarget &&
      !["notes", "history"].includes(question.mappingTarget) &&
      !question.mappingKey
    ) {
      errors.push(`Defina o campo de destino da pergunta “${question.title}”`)
    }
    if (["single_choice", "multiple_choice", "health_plan"].includes(question.type)) {
      if (question.options.length === 0) {
        errors.push(`Adicione opções à pergunta “${question.title}”`)
      }
      const values = question.options.map((option) => option.value)
      if (new Set(values).size !== values.length) {
        errors.push(`As opções da pergunta “${question.title}” devem ter valores únicos`)
      }
    }
  }
  for (const rule of draft.rules) {
    const sourceId = rule.sourceQuestionId
    const targetId = rule.targetQuestionId
    const targetOk =
      targetId === PUBLIC_FORM_THANK_YOU_TARGET ||
      (typeof targetId === "string" && questionIds.has(targetId))
    if (typeof sourceId !== "string" || !questionIds.has(sourceId) || !targetOk) {
      errors.push("Remova regras que apontam para perguntas inexistentes")
    }
    if (
      targetId === PUBLIC_FORM_THANK_YOU_TARGET &&
      rule.targetThankYouPageId &&
      !draft.thankYouPages.some((page) => page.id === rule.targetThankYouPageId)
    ) {
      errors.push("Regra referencia página de agradecimentos inexistente")
    }
    if (sourceId === targetId) {
      errors.push("Uma regra não pode controlar a própria pergunta")
    }
  }
  if (draft.thankYouPages.length === 0) {
    errors.push("Adicione ao menos uma página de agradecimentos")
  } else if (draft.thankYouPages.filter((page) => page.isDefault).length !== 1) {
    errors.push("Defina exatamente uma página de agradecimentos como padrão")
  }
  if (draft.questions.length > 0) {
    const totalWeight = draft.questions.reduce(
      (sum, question) => sum + (question.scoreWeight ?? 0),
      0,
    )
    if (totalWeight !== 100) {
      errors.push("A soma das pontuações das perguntas deve ser 100%")
    }
  }
  bands.forEach((band, index) => {
    if (band.minScore > band.maxScore) errors.push(`A faixa ${band.label} possui limites inválidos`)
    if (index > 0 && bands[index - 1].maxScore >= band.minScore) {
      errors.push(`A faixa ${band.label} se sobrepõe à faixa anterior`)
    }
  })
  return errors
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
    const result = await publicFormsService.getPublic(publicId)
    return result
      ? new Output(true, [], [], result)
      : new Output(false, [], ["Formulário indisponível"], null)
  }

  async getAvailabilityContext(publicId: string) {
    const result = await publicFormsService.getAvailabilityContext(publicId)
    return result
      ? new Output(true, [], [], result)
      : new Output(false, [], ["Formulário indisponível"], null)
  }

  async recordMetric(publicId: string, input: PublicFormMetricEventInput) {
    const accepted = await publicFormsService.recordMetric(publicId, input)
    return accepted
      ? new Output(true, [], [], { accepted: true })
      : new Output(false, [], ["Formulário indisponível"], null)
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
