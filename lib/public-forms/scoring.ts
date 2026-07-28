import type { PublicFormOptionInput, PublicFormQuestionInput } from "./types"

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

/** Distribute integer weights that sum exactly to `total` across `count` slots. */
export function distributeEvenWeights(count: number, total = 100): number[] {
  if (count <= 0) return []
  if (count === 1) return [total]
  const base = Math.floor(total / count)
  const remainder = total - base * count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

export function sumQuestionScoreWeights(questions: PublicFormQuestionInput[]): number {
  return questions.reduce((sum, question) => sum + clampPercent(question.scoreWeight ?? 0), 0)
}

/** Rebalance all question weights to sum exactly to 100 (equal shares). */
export function redistributeQuestionScoresEvenly(
  questions: PublicFormQuestionInput[],
): PublicFormQuestionInput[] {
  const weights = distributeEvenWeights(questions.length, 100)
  return questions.map((question, index) => ({
    ...question,
    scoreWeight: weights[index] ?? 0,
  }))
}

/**
 * After editing one question's weight, rescale the others so the form total stays 100.
 * If there are no siblings, the edited question is clamped to 100.
 */
export function rebalanceAfterQuestionWeightEdit(
  questions: PublicFormQuestionInput[],
  editedId: string,
  nextWeight: number,
): PublicFormQuestionInput[] {
  const clamped = clampPercent(nextWeight)
  if (questions.length === 0) return questions
  if (questions.length === 1) {
    return questions.map((question) =>
      question.id === editedId ? { ...question, scoreWeight: 100 } : question,
    )
  }

  const others = questions.filter((question) => question.id !== editedId)
  const remaining = Math.max(0, 100 - clamped)
  const otherSum = others.reduce((sum, question) => sum + Math.max(0, question.scoreWeight), 0)

  let distributed: number[]
  if (otherSum <= 0) {
    distributed = distributeEvenWeights(others.length, remaining)
  } else {
    const raw = others.map((question) => (question.scoreWeight / otherSum) * remaining)
    const floored = raw.map((value) => Math.floor(value))
    let leftover = remaining - floored.reduce((sum, value) => sum + value, 0)
    const ranked = raw
      .map((value, index) => ({ index, frac: value - Math.floor(value) }))
      .sort((a, b) => b.frac - a.frac)
    distributed = [...floored]
    for (const item of ranked) {
      if (leftover <= 0) break
      distributed[item.index] += 1
      leftover -= 1
    }
  }

  let otherIndex = 0
  return questions.map((question) => {
    if (question.id === editedId) return { ...question, scoreWeight: clamped }
    const scoreWeight = distributed[otherIndex] ?? 0
    otherIndex += 1
    return { ...question, scoreWeight }
  })
}

export function withEqualOptionScores(
  options: PublicFormOptionInput[],
): PublicFormOptionInput[] {
  if (options.length === 0) return options
  const weights = distributeEvenWeights(options.length, 100)
  return options.map((option, index) => ({
    ...option,
    score: weights[index] ?? 0,
    scorePolarity: option.scorePolarity ?? "positive",
  }))
}

export function signedOptionScore(option: Pick<PublicFormOptionInput, "score" | "scorePolarity">): number {
  const magnitude = Math.max(0, option.score)
  return option.scorePolarity === "negative" ? -magnitude : magnitude
}

function getMaxSelections(question: PublicFormQuestionInput): number | null {
  const maxSelections = question.config?.maxSelections
  if (typeof maxSelections !== "number" || !Number.isFinite(maxSelections)) return null
  const floored = Math.floor(maxSelections)
  return floored > 0 ? floored : null
}

/** Max positive relative score achievable within a choice question. */
export function maxPositiveRelativeScore(question: PublicFormQuestionInput): number {
  const positives = question.options
    .filter((option) => (option.scorePolarity ?? "positive") === "positive")
    .map((option) => Math.max(0, option.score))
    .sort((a, b) => b - a)

  if (question.type === "multiple_choice") {
    const maxSelections = getMaxSelections(question)
    const selectable = maxSelections != null ? positives.slice(0, maxSelections) : positives
    return selectable.reduce((sum, score) => sum + score, 0)
  }

  if (["single_choice", "health_plan", "boolean"].includes(question.type)) {
    return positives[0] ?? 0
  }

  return 0
}

export function isChoiceQuestionType(type: PublicFormQuestionInput["type"]): boolean {
  return ["single_choice", "multiple_choice", "health_plan", "boolean"].includes(type)
}

export function isAnswered(value: unknown): boolean {
  if (value == null || value === "") return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "boolean") return value === true
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    if ("startsAt" in record) return Boolean(record.startsAt)
  }
  return true
}
