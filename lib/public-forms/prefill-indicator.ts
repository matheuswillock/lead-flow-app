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

/**
 * A lógica condicional do renderer poda respostas de perguntas escondidas.
 * Uma pergunta prefillada que sumiu e voltou renasce vazia — manter o
 * indicador ali afirmaria "preenchido automaticamente" sobre um campo em
 * branco. Retém no conjunto só quem ainda tem resposta viva; devolve o
 * mesmo Set (referência) quando nada mudou, para não re-renderizar à toa.
 */
export function retainPrefilledFieldsWithAnswers<T>(
  prefilledFieldIds: Set<string>,
  currentAnswers: Record<string, T>,
): Set<string> {
  const retained = [...prefilledFieldIds].filter((questionId) => questionId in currentAnswers)
  if (retained.length === prefilledFieldIds.size) return prefilledFieldIds
  return new Set(retained)
}
