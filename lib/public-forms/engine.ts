import { parseCurrencyBR, phoneDigitCount } from "./masks"
import type { PublicFormAnswerInput, PublicFormDraftInput, PublicFormQuestionInput } from "./types"
const values = (v: unknown) => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)])
export function resolveVisibleQuestionIds(
  form: PublicFormDraftInput,
  answers: PublicFormAnswerInput[],
) {
  const map = new Map(answers.map((a) => [a.questionId, a.value])),
    visible = new Set(form.questions.map((q) => q.id).filter(Boolean) as string[])
  for (const r of form.rules) {
    const got = values(map.get(r.sourceQuestionId)),
      expected = values(r.comparisonValue)
    const hit =
      r.operator === "equals" || r.operator === "selected"
        ? expected.some((v) => got.includes(v))
        : r.operator === "not_equals" || r.operator === "not_selected"
          ? expected.every((v) => !got.includes(v))
          : got.some((v) => expected.some((e) => v.includes(e)))
    if ((r.action === "show" && !hit) || (r.action === "skip" && hit))
      visible.delete(r.targetQuestionId)
  }
  return form.questions
    .map((q) => q.id)
    .filter((id): id is string => Boolean(id && visible.has(id)))
}
export function calculatePublicFormScore(
  form: PublicFormDraftInput,
  answers: PublicFormAnswerInput[],
) {
  const qs = new Map(form.questions.map((q) => [q.id, q]))
  return answers.reduce(
    (sum, a) =>
      sum +
      (qs
        .get(a.questionId)
        ?.options.filter((o) => values(a.value).includes(o.value))
        .reduce((n, o) => n + o.score, 0) ?? 0),
    0,
  )
}
export function validateAnswer(q: PublicFormQuestionInput, v: unknown) {
  const empty = v == null || v === "" || (Array.isArray(v) && !v.length)
  if (q.required && empty) return "Esta resposta é obrigatória"
  if (empty) return null
  const s = String(v)
  if (q.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    return "Informe um e-mail válido"
  if (q.type === "phone") {
    const digits = phoneDigitCount(s)
    if (digits < 10 || digits > 11) return "Informe um telefone válido"
  }
  if (q.type === "currency") {
    const amount = typeof v === "number" ? v : parseCurrencyBR(s)
    if (!amount || amount <= 0) return "Informe um valor válido"
  }
  if (q.type === "date") {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null
    if (!parsed || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== s) {
      return "Informe uma data válida"
    }
  }
  if (q.type === "url") {
    try {
      new URL(s)
    } catch {
      return "Informe uma URL válida"
    }
  }
  if (q.type === "number" && !Number.isFinite(Number(v))) return "Informe um número válido"
  if (["single_choice", "health_plan"].includes(q.type)) {
    if (!q.options.some((option) => option.value === s)) return "Selecione uma opção válida"
  }
  if (q.type === "multiple_choice") {
    if (
      !Array.isArray(v) ||
      v.some((item) => !q.options.some((option) => option.value === String(item)))
    ) {
      return "Selecione opções válidas"
    }
  }
  if (q.type === "boolean" && !["sim", "nao"].includes(s)) return "Selecione uma opção válida"
  if (q.type === "scheduling") {
    if (typeof v !== "object" || v === null) return "Selecione a data e o horário"
    const scheduling = v as { startsAt?: unknown }
    if (typeof scheduling.startsAt !== "string" || !scheduling.startsAt) {
      return "Selecione a data e o horário"
    }
  }
  if (q.type === "consent" && v !== true) return "É necessário aceitar para continuar"
  return null
}
