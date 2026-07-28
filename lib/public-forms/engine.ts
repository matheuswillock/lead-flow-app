import { parseCurrencyBR, phoneDigitCount } from "./masks"
import {
  isAnswered,
  isChoiceQuestionType,
  maxPositiveRelativeScore,
  signedOptionScore,
} from "./scoring"
import type { PublicFormAnswerInput, PublicFormDraftInput, PublicFormQuestionInput } from "./types"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "./types"

const values = (v: unknown) => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)])

function inverseAction(action: "show" | "skip"): "show" | "skip" {
  return action === "show" ? "skip" : "show"
}

function ruleHits(
  operator: PublicFormDraftInput["rules"][number]["operator"],
  got: string[],
  expected: string[],
): boolean {
  if (operator === "equals" || operator === "selected") {
    return expected.some((v) => got.includes(v))
  }
  if (operator === "not_equals" || operator === "not_selected") {
    return expected.every((v) => !got.includes(v))
  }
  return got.some((v) => expected.some((e) => v.includes(e)))
}

function getMaxSelections(question: PublicFormQuestionInput): number | null {
  const maxSelections = question.config?.maxSelections
  if (typeof maxSelections !== "number" || !Number.isFinite(maxSelections)) return null
  const floored = Math.floor(maxSelections)
  return floored > 0 ? floored : null
}

/**
 * Earliest question index that triggers "show thank-you", or null when the flow continues.
 */
export function getThankYouCutoffIndex(
  form: PublicFormDraftInput,
  answers: PublicFormAnswerInput[],
): number | null {
  const map = new Map(answers.map((a) => [a.questionId, a.value]))
  let cutoff: number | null = null
  for (const rule of form.rules) {
    if (rule.targetQuestionId !== PUBLIC_FORM_THANK_YOU_TARGET) continue
    const got = values(map.get(rule.sourceQuestionId))
    const expected = values(rule.comparisonValue)
    const hit = ruleHits(rule.operator, got, expected)
    const elseAction = rule.elseAction ?? inverseAction(rule.action)
    const effective = hit ? rule.action : elseAction
    if (effective !== "show") continue
    const sourceIndex = form.questions.findIndex((question) => question.id === rule.sourceQuestionId)
    if (sourceIndex < 0) continue
    cutoff = cutoff == null ? sourceIndex : Math.min(cutoff, sourceIndex)
  }
  return cutoff
}

export function resolveVisibleQuestionIds(
  form: PublicFormDraftInput,
  answers: PublicFormAnswerInput[],
) {
  const map = new Map(answers.map((a) => [a.questionId, a.value])),
    visible = new Set(form.questions.map((q) => q.id).filter(Boolean) as string[])
  for (const r of form.rules) {
    if (r.targetQuestionId === PUBLIC_FORM_THANK_YOU_TARGET) continue
    const got = values(map.get(r.sourceQuestionId)),
      expected = values(r.comparisonValue)
    const hit = ruleHits(r.operator, got, expected)
    const elseAction = r.elseAction ?? inverseAction(r.action)
    const effective = hit ? r.action : elseAction
    if (effective === "skip") visible.delete(r.targetQuestionId)
  }

  // Early thank-you exit: remaining questions after the terminating source are not required.
  const cutoffIndex = getThankYouCutoffIndex(form, answers)
  if (cutoffIndex != null) {
    for (const [index, question] of form.questions.entries()) {
      if (index > cutoffIndex && question.id) visible.delete(question.id)
    }
  }

  return form.questions
    .map((q) => q.id)
    .filter((id): id is string => Boolean(id && visible.has(id)))
}

/** True when a rule branch targets the thank-you page for the current answers. */
export function shouldGoToThankYou(
  form: PublicFormDraftInput,
  answers: PublicFormAnswerInput[],
): boolean {
  return getThankYouCutoffIndex(form, answers) != null
}

/** Snapshots published before scoreWeight use the legacy option-score model. */
export function usesLegacyOptionScoring(form: PublicFormDraftInput): boolean {
  const weightSum = form.questions.reduce(
    (sum, question) => sum + Math.max(0, question.scoreWeight ?? 0),
    0,
  )
  return weightSum <= 0
}

function contributionForChoice(
  question: PublicFormQuestionInput,
  answerValue: unknown,
): number {
  const weight = Math.max(0, question.scoreWeight ?? 0)
  if (weight <= 0) return 0
  const maxRelative = maxPositiveRelativeScore(question)
  const selected = question.options.filter((option) =>
    values(answerValue).includes(option.value),
  )
  const raw = selected.reduce((sum, option) => sum + signedOptionScore(option), 0)
  if (maxRelative <= 0) return 0
  return (raw / maxRelative) * weight
}

function contributionForNonChoice(
  question: PublicFormQuestionInput,
  answerValue: unknown,
): number {
  const weight = Math.max(0, question.scoreWeight ?? 0)
  if (weight <= 0) return 0
  return isAnswered(answerValue) ? weight : 0
}

function calculateLegacyOptionScore(
  form: PublicFormDraftInput,
  answers: PublicFormAnswerInput[],
): number {
  const qs = new Map(form.questions.map((q) => [q.id, q]))
  return answers.reduce((sum, answer) => {
    const question = qs.get(answer.questionId)
    if (!question?.options.length) return sum
    return (
      sum +
      question.options
        .filter((option) => values(answer.value).includes(option.value))
        .reduce((n, option) => n + Math.max(0, option.score), 0)
    )
  }, 0)
}

function calculateLegacyMaxPossibleScore(form: PublicFormDraftInput): number {
  return form.questions.reduce((sum, question) => {
    if (!question.options.length) return sum
    if (question.type === "multiple_choice") {
      const positiveScores = question.options
        .map((option) => Math.max(0, option.score))
        .sort((a, b) => b - a)
      const maxSelections = getMaxSelections(question)
      const selectable =
        maxSelections != null ? positiveScores.slice(0, maxSelections) : positiveScores
      return sum + selectable.reduce((n, score) => n + score, 0)
    }
    if (["single_choice", "health_plan", "boolean"].includes(question.type)) {
      return sum + Math.max(0, ...question.options.map((option) => option.score), 0)
    }
    return sum
  }, 0)
}

/**
 * Score already in 0–100% using question scoreWeights (form budget).
 * Floored at 0 when negative options pull below zero.
 * Legacy snapshots without scoreWeight keep option-score semantics.
 */
export function calculatePublicFormScore(
  form: PublicFormDraftInput,
  answers: PublicFormAnswerInput[],
) {
  if (usesLegacyOptionScoring(form)) {
    return Math.max(0, calculateLegacyOptionScore(form, answers))
  }
  const qs = new Map(form.questions.map((q) => [q.id, q]))
  const raw = answers.reduce((sum, answer) => {
    const question = qs.get(answer.questionId)
    if (!question) return sum
    if (isChoiceQuestionType(question.type) && question.options.length > 0) {
      return sum + contributionForChoice(question, answer.value)
    }
    if (question.type === "calculation") return sum
    return sum + contributionForNonChoice(question, answer.value)
  }, 0)
  return Math.max(0, raw)
}

/** Max possible score is the form budget of question weights (always 100 when balanced). */
export function calculatePublicFormMaxPossibleScore(form: PublicFormDraftInput) {
  if (usesLegacyOptionScoring(form)) {
    return calculateLegacyMaxPossibleScore(form)
  }
  return form.questions.reduce((sum, question) => {
    if (question.type === "calculation") return sum
    return sum + Math.max(0, question.scoreWeight ?? 0)
  }, 0)
}

export function calculatePublicFormScorePercent(
  form: PublicFormDraftInput,
  answers: PublicFormAnswerInput[],
) {
  const raw = calculatePublicFormScore(form, answers)
  const max = calculatePublicFormMaxPossibleScore(form)
  if (max <= 0) return 0
  return Math.min(100, Math.round((100 * raw) / max))
}

export function validateAnswer(q: PublicFormQuestionInput, v: unknown) {
  if (q.type === "calculation") return null
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
    const maxSelections = getMaxSelections(q)
    if (maxSelections != null && v.length > maxSelections) {
      return `Selecione no máximo ${maxSelections} opções`
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
