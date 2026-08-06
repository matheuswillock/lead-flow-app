import type { PublicFormDraftInput } from "./types"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "./types"
import { getPageKey } from "./pages"

export type ValidatePublicFormDraftMode = "form" | "catalog-template"

export type ValidatePublicFormDraftOptions = {
  mode?: ValidatePublicFormDraftMode
}

function hasHardcodedWhatsappAction(draft: PublicFormDraftInput): boolean {
  const fromSuccess = draft.successActions.some(
    (action) => action.type === "whatsapp" && Boolean(action.whatsappPhone?.trim()),
  )
  const fromPages = draft.thankYouPages.some((page) =>
    page.actions.some(
      (action) => action.type === "whatsapp" && Boolean(action.whatsappPhone?.trim()),
    ),
  )
  return fromSuccess || fromPages
}

export function validatePublicFormDraft(
  draft: PublicFormDraftInput,
  options: ValidatePublicFormDraftOptions = {},
): string[] {
  const mode = options.mode ?? "form"
  const errors: string[] = []

  if (!draft.name.trim()) errors.push("Informe o nome do formulário")
  if (draft.questions.length === 0) errors.push("Adicione pelo menos uma pergunta")

  const nameQuestion = draft.questions.find(
    (question) => question.mappingTarget === "native_field" && question.mappingKey === "name",
  )
  if (!nameQuestion) {
    errors.push("Mapeie uma pergunta para o campo obrigatório Nome")
  } else {
    if (!nameQuestion.required) {
      errors.push("A pergunta mapeada para Nome deve ser obrigatória")
    }
    if (draft.rules.some((rule) => rule.targetQuestionId === nameQuestion.id)) {
      errors.push("A pergunta mapeada para Nome não pode ser condicional")
    }
  }

  if (mode === "form") {
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
    if (question.type === "email" && question.mappingTarget === "history") {
      errors.push(
        `A pergunta de e-mail “${question.title}” deve mapear ao campo nativo E-mail, não ao histórico`,
      )
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

  if (mode === "catalog-template" && hasHardcodedWhatsappAction(draft)) {
    errors.push(
      "Templates globais não podem incluir ação de WhatsApp com número fixo. Remova o CTA de WhatsApp.",
    )
  }

  return errors
}
