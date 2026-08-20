import { parseCurrencyBR, phoneDigitCount } from "./masks"
import {
  isAnswered,
  isChoiceQuestionType,
  maxPositiveRelativeScore,
  signedOptionScore,
} from "./scoring"
import type { PublicFormAnswerInput, PublicFormDraftInput, PublicFormQuestionInput } from "./types"
import { isThankYouRuleTarget } from "./thank-you-pages"

const values = (v: unknown) => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)])

export type RuleEffectiveAction = "show" | "skip" | "jump_to"

function normalizeBooleanValue(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
  if (["sim", "yes", "true", "s"].includes(normalized)) return "sim"
  if (["nao", "no", "false", "n"].includes(normalized)) return "nao"
  return value
}

function normalizeComparisonValues(
  rawValues: string[],
  sourceQuestion?: PublicFormQuestionInput,
): string[] {
  if (sourceQuestion?.type === "boolean") {
    return rawValues.map(normalizeBooleanValue)
  }
  return rawValues
}

export function inverseRuleAction(action: RuleEffectiveAction): RuleEffectiveAction {
  if (action === "show") return "skip"
  if (action === "skip") return "show"
  return "show"
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

function isThankYouRule(rule: PublicFormDraftInput["rules"][number]): boolean {
  return isThankYouRuleTarget(rule.targetQuestionId)
}

function effectiveRuleAction(
  rule: PublicFormDraftInput["rules"][number],
  map: Map<string, unknown>,
  questions: PublicFormQuestionInput[],
): RuleEffectiveAction | null {
  const sourceQuestion = questions.find((question) => question.id === rule.sourceQuestionId)
  const sourceAnswer = map.get(rule.sourceQuestionId)
  if (!isAnswered(sourceAnswer)) return null
  const got = normalizeComparisonValues(values(sourceAnswer), sourceQuestion)
  const expected = normalizeComparisonValues(values(rule.comparisonValue), sourceQuestion)
  const hit = ruleHits(rule.operator, got, expected)
  const elseAction = rule.elseAction ?? inverseRuleAction(rule.action)
  return hit ? rule.action : elseAction
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
    if (!isThankYouRule(rule)) continue
    const effective = effectiveRuleAction(rule, map, form.questions)
    if (effective !== "show") continue
    const sourceIndex = form.questions.findIndex((question) => question.id === rule.sourceQuestionId)
    if (sourceIndex < 0) continue
    cutoff = cutoff == null ? sourceIndex : Math.min(cutoff, sourceIndex)
  }
  return cutoff
}

/** Resolves which thank-you page to show; null means use default page at completion. */
export function resolveThankYouPageId(
  form: PublicFormDraftInput,
  answers: PublicFormAnswerInput[],
): string | null {
  const map = new Map(answers.map((a) => [a.questionId, a.value]))
  let winner: { sourceIndex: number; pageId: string | null } | null = null
  for (const rule of form.rules) {
    if (!isThankYouRule(rule)) continue
    const effective = effectiveRuleAction(rule, map, form.questions)
    if (effective !== "show") continue
    const sourceIndex = form.questions.findIndex((question) => question.id === rule.sourceQuestionId)
    if (sourceIndex < 0) continue
    const pageId = rule.targetThankYouPageId ?? null
    if (!winner || sourceIndex < winner.sourceIndex) {
      winner = { sourceIndex, pageId }
    }
  }
  if (winner) return winner.pageId
  return form.defaultThankYouPageId ?? null
}

export function resolveVisibleQuestionIds(
  form: PublicFormDraftInput,
  answers: PublicFormAnswerInput[],
) {
  const map = new Map(answers.map((a) => [a.questionId, a.value])),
    visible = new Set(form.questions.map((q) => q.id).filter(Boolean) as string[])
  for (const r of form.rules) {
    if (isThankYouRule(r)) continue
    const effective = effectiveRuleAction(r, map, form.questions)
    if (effective === "skip") {
      visible.delete(r.targetQuestionId)
      continue
    }
    if (effective === "jump_to") {
      const sourceIndex = form.questions.findIndex((question) => question.id === r.sourceQuestionId)
      const targetIndex = form.questions.findIndex((question) => question.id === r.targetQuestionId)
      if (sourceIndex >= 0 && targetIndex > sourceIndex) {
        for (let index = sourceIndex + 1; index < targetIndex; index += 1) {
          const questionId = form.questions[index]?.id
          if (questionId) visible.delete(questionId)
        }
      }
    }
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

function isEmailQuestion(question: PublicFormQuestionInput): boolean {
  return question.type === "email" || (question.type === "text" && question.mappingKey === "email")
}

/** Campo mapeado ao lead.name — regras de UX no formulário público (independentes do gate de CRM). */
export const PUBLIC_FORM_LEAD_NAME_MIN_LENGTH = 3
export const PUBLIC_FORM_LEAD_NAME_MAX_LENGTH = 30

export function isLeadNameQuestion(question: PublicFormQuestionInput): boolean {
  return question.mappingKey === "name"
}

export const PUBLIC_FORM_LEAD_NAME_EMAIL_ERROR = "Informe um nome de pessoa, não um e-mail"

export function validateLeadNameAnswer(value: unknown): string | null {
  const trimmed = String(value ?? "").trim()
  if (!trimmed) return null
  if (trimmed.includes("@")) return PUBLIC_FORM_LEAD_NAME_EMAIL_ERROR
  if (trimmed.length < PUBLIC_FORM_LEAD_NAME_MIN_LENGTH) {
    return `Informe um nome com pelo menos ${PUBLIC_FORM_LEAD_NAME_MIN_LENGTH} caracteres`
  }
  if (trimmed.length > PUBLIC_FORM_LEAD_NAME_MAX_LENGTH) {
    return `Informe um nome com no máximo ${PUBLIC_FORM_LEAD_NAME_MAX_LENGTH} caracteres`
  }
  return null
}

function copyNameValueToEmptyEmail(options: {
  nameValue: unknown
  currentEmailValue: unknown
  previousNameValue: unknown
}): string | null {
  const nameText = String(options.nameValue ?? "").trim()
  if (!nameText.includes("@")) return null
  const currentEmail = String(options.currentEmailValue ?? "").trim()
  const previousName = String(options.previousNameValue ?? "").trim()
  const emailIsEmpty = currentEmail.length === 0
  const emailWasCopiedFromName = currentEmail === previousName
  if (!emailIsEmpty && !emailWasCopiedFromName) return null
  return nameText
}

export function applyLeadNameAnswerToFormAnswers(options: {
  questions: Array<{ id: string; mappingKey?: string | null }>
  currentAnswers: Record<string, unknown>
  nameQuestionId: string
  nameValue: unknown
}): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...options.currentAnswers,
    [options.nameQuestionId]: options.nameValue,
  }
  const emailQuestion = options.questions.find((question) => question.mappingKey === "email")
  if (!emailQuestion) return next

  const copiedEmail = copyNameValueToEmptyEmail({
    nameValue: options.nameValue,
    currentEmailValue: options.currentAnswers[emailQuestion.id],
    previousNameValue: options.currentAnswers[options.nameQuestionId],
  })
  if (copiedEmail) {
    next[emailQuestion.id] = copiedEmail
  }
  return next
}

function parseCurrencyAnswer(value: unknown): {
  empty: boolean
  amount: number
  valid: boolean
} {
  if (value == null || value === "") {
    return { empty: true, amount: 0, valid: true }
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { empty: false, amount: 0, valid: false }
    return { empty: false, amount: value, valid: true }
  }

  const raw = String(value).trim()
  if (!raw) return { empty: true, amount: 0, valid: true }

  const digits = raw.replace(/\D/g, "")
  if (!digits) return { empty: false, amount: 0, valid: false }

  const amount = parseCurrencyBR(raw)
  if (!Number.isFinite(amount)) return { empty: false, amount: 0, valid: false }
  return { empty: false, amount, valid: true }
}

export function validateAnswer(q: PublicFormQuestionInput, v: unknown) {
  if (q.type === "calculation") return null
  const empty = v == null || v === "" || (Array.isArray(v) && !v.length)
  if (q.required && empty) return "Esta resposta é obrigatória"
  if (empty) return null
  const s = String(v)
  if (isEmailQuestion(q) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    return "Informe um e-mail válido"
  if (isLeadNameQuestion(q)) {
    const nameError = validateLeadNameAnswer(v)
    if (nameError) return nameError
  }
  if (q.type === "phone") {
    const digits = phoneDigitCount(s)
    if (digits < 10 || digits > 11) return "Informe um telefone válido"
  }
  if (q.type === "currency") {
    const parsed = parseCurrencyAnswer(v)
    if (!q.required && parsed.empty) return null
    if (!parsed.valid) return "Informe um valor válido"
    if (!q.required && parsed.amount <= 0) return null
    if (parsed.amount <= 0) return "Informe um valor válido"
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
