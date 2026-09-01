import type { PublicFormAnswerInput, PublicFormSnapshot } from "@/lib/public-forms/types"

export const FORM_COMPLETION_ACTIVITY_PREFIX = "Nova resposta de formulário"

export type FormCompletionIdentity = {
  name?: string | null
  phone?: string | null
  email?: string | null
}

function answerText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join(", ")
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "Sim" : "Não"
  return String(value)
}

/**
 * Corpo da atividade de conclusão do formulário no card.
 *
 * O note genérico "Fim do preenchimento do formulário" era metade do bug de
 * 31/08: com a resposta anexada num card de outra pessoa, nada na timeline
 * dizia quem respondeu nem o que respondeu — o cliente concluía que "não
 * chegou". Aqui a identidade digitada e os pares pergunta → resposta ficam
 * visíveis, o que também torna o anexo indevido detectável a olho.
 */
export function buildFormCompletionActivityBody(input: {
  snapshot: PublicFormSnapshot
  answers: PublicFormAnswerInput[]
  visibleIds?: Set<string>
  identity?: FormCompletionIdentity | null
}): string {
  const visible = input.visibleIds
  const answerMap = new Map(input.answers.map((answer) => [answer.questionId, answer.value]))

  const identityParts = [
    input.identity?.name?.trim(),
    input.identity?.phone?.trim(),
    input.identity?.email?.trim(),
  ].filter((part): part is string => Boolean(part))
  const header = identityParts.length
    ? `${FORM_COMPLETION_ACTIVITY_PREFIX} — ${identityParts.join(" · ")}`
    : FORM_COMPLETION_ACTIVITY_PREFIX

  const lines: string[] = []
  for (const question of input.snapshot.questions) {
    if (visible && !visible.has(question.id)) continue
    if (!answerMap.has(question.id)) continue
    const text = answerText(answerMap.get(question.id)).trim()
    if (!text) continue
    lines.push(`${question.title}: ${text}`)
  }

  return lines.length ? `${header}\n\n${lines.join("\n")}` : header
}
