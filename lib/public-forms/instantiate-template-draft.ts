import type { PublicFormDraftInput } from "./types"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "./types"

/**
 * Clona um draft de template com IDs novos para evitar colisão de PK
 * ao criar múltiplos formulários a partir do mesmo snapshot.
 */
export function instantiatePublicFormTemplateDraft(
  draft: PublicFormDraftInput,
): PublicFormDraftInput {
  const questionIdMap = new Map<string, string>()
  const questions = draft.questions.map((question) => {
    const nextId = crypto.randomUUID()
    if (question.id) questionIdMap.set(question.id, nextId)
    return {
      ...question,
      id: nextId,
      options: question.options.map((option) => ({ ...option, id: crypto.randomUUID() })),
    }
  })

  const thankYouPageIdMap = new Map<string, string>()
  const thankYouPages = draft.thankYouPages.map((page) => {
    const nextId = crypto.randomUUID()
    thankYouPageIdMap.set(page.id, nextId)
    return {
      ...page,
      id: nextId,
      actions: page.actions.map((action) => ({ ...action, id: crypto.randomUUID() })),
    }
  })

  const defaultThankYouPageId =
    thankYouPageIdMap.get(draft.defaultThankYouPageId) ?? thankYouPages[0]?.id ?? ""

  return {
    ...draft,
    coverHighlights: (draft.coverHighlights ?? []).map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    })),
    thankYouPages,
    defaultThankYouPageId,
    questions,
    rules: draft.rules.map((rule) => ({
      ...rule,
      id: crypto.randomUUID(),
      sourceQuestionId: questionIdMap.get(rule.sourceQuestionId) ?? rule.sourceQuestionId,
      targetQuestionId:
        rule.targetQuestionId === PUBLIC_FORM_THANK_YOU_TARGET
          ? PUBLIC_FORM_THANK_YOU_TARGET
          : (questionIdMap.get(rule.targetQuestionId) ?? rule.targetQuestionId),
      targetThankYouPageId: rule.targetThankYouPageId
        ? (thankYouPageIdMap.get(rule.targetThankYouPageId) ?? rule.targetThankYouPageId)
        : null,
    })),
    scoreBands: draft.scoreBands.map((band) => ({ ...band, id: crypto.randomUUID() })),
    successActions: draft.successActions.map((action) => ({
      ...action,
      id: crypto.randomUUID(),
    })),
  }
}
