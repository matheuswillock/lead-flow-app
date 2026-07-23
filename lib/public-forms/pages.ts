import type { PublicFormDraftInput, PublicFormQuestionInput } from "./types"

export function getPageKey(question: {
  id?: string | null
  config?: unknown
}): string {
  const config = question.config
  if (config && typeof config === "object" && !Array.isArray(config)) {
    const key = (config as Record<string, unknown>).pageKey
    if (typeof key === "string" && key.length > 0) return key
  }
  return question.id ?? ""
}

export function groupQuestionsByPage(
  questions: PublicFormQuestionInput[],
): Array<{ pageKey: string; questions: PublicFormQuestionInput[] }> {
  const order: string[] = []
  const map = new Map<string, PublicFormQuestionInput[]>()
  for (const question of questions) {
    const pageKey = getPageKey(question)
    if (!map.has(pageKey)) {
      order.push(pageKey)
      map.set(pageKey, [])
    }
    map.get(pageKey)!.push(question)
  }
  return order.map((pageKey) => ({ pageKey, questions: map.get(pageKey)! }))
}

export function getQuestionStepErrors(draft: PublicFormDraftInput): string[] {
  const errors: string[] = []
  const pages = groupQuestionsByPage(draft.questions)
  const schedulingQuestions = draft.questions.filter((question) => question.type === "scheduling")

  if (schedulingQuestions.length > 1) {
    errors.push("Só é permitido uma pergunta de agendamento por formulário")
  }
  if (draft.schedulingEnabled || schedulingQuestions.length > 0) {
    if (draft.eligibleCloserIds.length === 0) {
      errors.push("Selecione ao menos um closer elegível para o agendamento")
    }
  }

  for (const question of draft.questions) {
    if (!question.title.trim()) {
      errors.push("Toda pergunta precisa de um título")
      break
    }
  }

  for (const question of draft.questions) {
    if (
      question.mappingTarget &&
      !["notes", "history"].includes(question.mappingTarget) &&
      !question.mappingKey
    ) {
      errors.push(`Defina o campo de destino da pergunta “${question.title || "sem título"}”`)
    }
    if (["single_choice", "multiple_choice", "health_plan"].includes(question.type)) {
      if (question.options.length === 0) {
        errors.push(`Adicione opções à pergunta “${question.title || "sem título"}”`)
      }
    }
  }

  for (const page of pages) {
    if (page.questions.length > 3) {
      errors.push("Cada página pode ter no máximo 3 campos")
      break
    }
    const hasScheduling = page.questions.some((question) => question.type === "scheduling")
    if (hasScheduling && page.questions.length > 1) {
      errors.push("A pergunta de agendamento deve ficar sozinha na página")
      break
    }
    const hasCalculation = page.questions.some((question) => question.type === "calculation")
    if (hasCalculation && page.questions.length > 1) {
      errors.push("A pergunta de cálculo deve ficar sozinha na página")
      break
    }
  }

  const calculationQuestions = draft.questions.filter((question) => question.type === "calculation")
  if (calculationQuestions.length > 1) {
    errors.push("Só é permitido uma pergunta de cálculo por formulário")
  }

  return [...new Set(errors)]
}

export const QUESTION_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "scheduling", label: "Agendamento" },
  { value: "calculation", label: "Cálculo / Simulação" },
  { value: "crm_field", label: "Campo CRM" },
  { value: "custom_field", label: "Campo personalizado" },
  { value: "consent", label: "Consentimento" },
  { value: "date", label: "Data" },
  { value: "email", label: "E-mail" },
  { value: "single_choice", label: "Escolha única" },
  { value: "currency", label: "Moeda" },
  { value: "multiple_choice", label: "Múltipla escolha" },
  { value: "number", label: "Número" },
  { value: "health_plan", label: "Operadora" },
  { value: "boolean", label: "Sim/Não" },
  { value: "phone", label: "Telefone" },
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "url", label: "URL" },
].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
