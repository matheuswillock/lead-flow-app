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

/**
 * SPEC 40 E4/DA4 — a exigência é **telefone**, não "telefone ou e-mail".
 *
 * A DA4, escrita em 24/08, dizia "pelo menos um de telefone/e-mail". Mas quem
 * de fato cria lead é `canCreateLeadFromExtracted`: nome de pessoa **+ telefone
 * brasileiro válido**. E-mail sozinho só permite *atualizar* lead já existente
 * (`canUpdateLeadFromExtracted`). Um formulário de captação com nome+e-mail
 * publicava e depois descartava todo respondente novo com `sem_telefone` —
 * exatamente o "estruturalmente incapaz de converter" que este estágio existe
 * para impedir (review #1051).
 *
 * A DA4 pressupunha o **D2b** (lead por e-mail identificado), que segue em
 * aberto. Quando D2b for aprovado, esta regra volta a aceitar e-mail — e o gate
 * muda junto, no mesmo PR, senão a inconsistência volta.
 */
export const CONTACT_QUESTION_ERROR =
  "Mapeie uma pergunta para Telefone — o lead só nasce com nome e telefone brasileiro válido, então sem esse campo o formulário não capta ninguém novo. Se for um formulário de pesquisa, desative a captação de leads."

/**
 * SPEC 40 E4/DA4 — combinação impossível, achada no review do PR unificado.
 *
 * O agendamento nasce preso ao lead: `processInBackground` só chama
 * `scheduleMeeting` quando há lead resolvido. Com a captação desligada nunca há
 * — então o visitante escolheria o horário, veria a tela de agradecimento, e
 * nenhuma reunião existiria. Promessa quebrada com uma pessoa real, em silêncio.
 *
 * Recusar na publicação em vez de desligar a agenda sozinho: apagar
 * configuração do dono do form sem avisar é pior que barrar com o motivo.
 */
export const SURVEY_WITH_SCHEDULING_ERROR =
  "Agenda e captação de leads desligada não combinam: sem lead o formulário não cria a reunião que o visitante escolher. Ative a captação de leads ou remova a agenda."

function hasMappedContactQuestion(draft: PublicFormDraftInput): boolean {
  return draft.questions.some(
    (question) => question.mappingTarget === "native_field" && question.mappingKey === "phone",
  )
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
    // DA4: nome sozinho não gera lead pela regra vigente (nome + telefone BR).
    // Um form de captação sem NENHUM canal de contato mapeado é estruturalmente
    // incapaz de converter — e publicava assim mesmo (F5). `leadCaptureDisabled`
    // é a saída explícita para pesquisa, e desliga o funil de lead junto.
    if (!draft.leadCaptureDisabled && !hasMappedContactQuestion(draft)) {
      errors.push(CONTACT_QUESTION_ERROR)
    }
    if (draft.leadCaptureDisabled && draft.schedulingEnabled) {
      errors.push(SURVEY_WITH_SCHEDULING_ERROR)
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
