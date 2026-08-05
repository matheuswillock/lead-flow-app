import {
  DEFAULT_ENGAGEMENT_CONFIG,
  bandFromScore,
  resolveFormEngagementMultiplier,
  type EngagementBand,
  type EngagementConfig,
  type FormEngagementScoreRule,
} from "@/lib/radar/engagement-score"
import { calculatePublicFormScorePercent } from "@/lib/public-forms/engine"
import type {
  PublicFormAnswerInput,
  PublicFormDraftInput,
  PublicFormQuestionInput,
} from "@/lib/public-forms/types"

export type FormEngagementConfig = {
  formCompletedBaseWeight: number
  formEngagementScoreRules: FormEngagementScoreRule[]
  engagementConfig?: EngagementConfig
}

const CHOICE_TYPES = new Set(["single_choice", "multiple_choice", "health_plan", "boolean"])

function isChoiceQuestion(question: PublicFormQuestionInput): boolean {
  return CHOICE_TYPES.has(question.type) && question.options.length > 0
}

function formHasScoreWeights(form: PublicFormDraftInput): boolean {
  return form.questions.some((q) => Math.max(0, q.scoreWeight ?? 0) > 0)
}

/** Opção "neutra" (~50% do max positivo) para simular o restante do formulário. */
function pickNeutralOptionValue(question: PublicFormQuestionInput): string | null {
  const positives = question.options
    .filter((o) => (o.scorePolarity ?? "positive") === "positive")
    .map((o) => ({ option: o, score: Math.max(0, o.score) }))
    .sort((a, b) => b.score - a.score)

  if (positives.length === 0) {
    return question.options[0]?.value ?? null
  }

  const max = positives[0]!.score
  const target = max * 0.5
  let best = positives[positives.length - 1]!
  let bestDelta = Math.abs(best.score - target)
  for (const item of positives) {
    const delta = Math.abs(item.score - target)
    if (delta < bestDelta) {
      best = item
      bestDelta = delta
    }
  }
  return best.option.value
}

function buildHypotheticalAnswers(
  form: PublicFormDraftInput,
  questionId: string,
  optionId: string
): PublicFormAnswerInput[] | null {
  const targetQuestion = form.questions.find((q) => q.id === questionId)
  if (!targetQuestion || !isChoiceQuestion(targetQuestion)) return null

  const targetOption = targetQuestion.options.find((o) => o.id === optionId)
  if (!targetOption) return null

  const answers: PublicFormAnswerInput[] = []

  for (const question of form.questions) {
    if (!question.id) continue
    if (question.type === "calculation") continue

    if (question.id === questionId) {
      answers.push({
        questionId: question.id,
        value: question.type === "multiple_choice" ? [targetOption.value] : targetOption.value,
      })
      continue
    }

    if (!isChoiceQuestion(question)) {
      if (Math.max(0, question.scoreWeight ?? 0) > 0) {
        answers.push({ questionId: question.id, value: "preview" })
      }
      continue
    }

    const neutral = pickNeutralOptionValue(question)
    if (!neutral) continue
    answers.push({
      questionId: question.id,
      value: question.type === "multiple_choice" ? [neutral] : neutral,
    })
  }

  return answers
}

/**
 * Estima a banda de temperatura se o lead escolher esta opção
 * (demais perguntas em cenário neutro ~50%). Função pura.
 */
export function previewTemperatureForOption(
  form: PublicFormDraftInput,
  questionId: string,
  optionId: string,
  config: FormEngagementConfig | null | undefined
): EngagementBand | null {
  if (!config || config.formCompletedBaseWeight <= 0) return null
  if (!formHasScoreWeights(form)) return null

  const answers = buildHypotheticalAnswers(form, questionId, optionId)
  if (!answers) return null

  const scorePercent = calculatePublicFormScorePercent(form, answers)
  const multiplier = resolveFormEngagementMultiplier(
    scorePercent,
    config.formEngagementScoreRules
  )
  const effectiveWeight = Math.round(config.formCompletedBaseWeight * multiplier)
  const engagementConfig = config.engagementConfig ?? DEFAULT_ENGAGEMENT_CONFIG
  // Preview assume janela recente (× recentMultiplier) — o lead acabou de enviar.
  const projectedScore = Math.min(
    100,
    Math.max(0, Math.round(effectiveWeight * engagementConfig.recentMultiplier))
  )
  return bandFromScore(projectedScore, engagementConfig)
}

export const TEMPERATURE_BAND_LABEL: Record<EngagementBand, string> = {
  hot: "Quente",
  warm: "Morno",
  lukewarm: "Morno-frio",
  cold: "Frio",
}
