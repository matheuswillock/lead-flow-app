import type { PublicFormAnswerInput } from "@/lib/public-forms/types"

function isEmptyAnswerValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * Blur envia uma resposta por vez. O gate A+C e o persist precisam do
 * acumulado da sessão — sem isso o blur de telefone apagaria o nome.
 */
export function mergeProgressAnswers(input: {
  stored: PublicFormAnswerInput[]
  incoming: PublicFormAnswerInput[]
}): PublicFormAnswerInput[] {
  const merged = new Map<string, PublicFormAnswerInput>()

  for (const answer of input.stored) {
    if (!answer.questionId) continue
    merged.set(answer.questionId, answer)
  }

  for (const answer of input.incoming) {
    if (!answer.questionId) continue
    const existing = merged.get(answer.questionId)
    if (
      existing &&
      isEmptyAnswerValue(answer.value) &&
      !isEmptyAnswerValue(existing.value)
    ) {
      continue
    }
    merged.set(answer.questionId, answer)
  }

  return [...merged.values()]
}
