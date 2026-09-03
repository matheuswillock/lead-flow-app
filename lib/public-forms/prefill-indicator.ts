/**
 * Item A do registro 03/09 (owner): todo campo preenchido pelo prefill de
 * `cs_el` precisa de um indicador visível — caso ED-ENERGY, prefill de
 * "Nome completo" com razão social de base B2B enviado sem o visitante notar.
 * Este módulo isola a regra de QUAIS perguntas o prefill de fato definiu (sem
 * mudar a regra de prefill em si, que continua em `PublicFormRenderer`).
 */

export type PrefillableQuestion = {
  id: string
  mappingKey?: string | null
}

export type PublicFormPrefillResult = {
  name: string | null
  email: string | null
}

/**
 * Espelha a condição usada pelo efeito de prefill: uma pergunta só entra no
 * indicador quando o prefill de fato vai definir seu valor — isto é, o
 * mapeamento bate (nome/e-mail) e o visitante ainda não tinha respondido nada
 * ali. Campo digitado pelo visitante nunca é marcado.
 */
export function resolvePrefilledFieldIds(input: {
  questions: PrefillableQuestion[]
  prefill: PublicFormPrefillResult
  currentAnswers: Record<string, unknown>
}): Set<string> {
  const prefilledIds = new Set<string>()
  for (const question of input.questions) {
    if (
      question.mappingKey === "name" &&
      input.prefill.name &&
      !input.currentAnswers[question.id]
    ) {
      prefilledIds.add(question.id)
    }
    if (
      question.mappingKey === "email" &&
      input.prefill.email &&
      !input.currentAnswers[question.id]
    ) {
      prefilledIds.add(question.id)
    }
  }
  return prefilledIds
}

/**
 * O indicador some assim que o visitante edita o campo: a partir daí o valor
 * é digitado, não mais automático. Outros campos prefillados permanecem
 * marcados — a edição é por campo, não global.
 */
export function withoutPrefilledField(
  prefilledFieldIds: ReadonlySet<string>,
  editedQuestionId: string,
): Set<string> {
  if (!prefilledFieldIds.has(editedQuestionId)) {
    return new Set(prefilledFieldIds)
  }
  const next = new Set(prefilledFieldIds)
  next.delete(editedQuestionId)
  return next
}
