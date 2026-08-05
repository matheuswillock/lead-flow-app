import { Output } from "@/lib/output"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { backofficeRadarEngagementRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeRadarEngagement/BackofficeRadarEngagementRepository"
import { signedOptionScore } from "@/lib/public-forms/scoring"
import {
  DEFAULT_FORM_ENGAGEMENT_SCORE_RULES,
  resolveFormEngagementMultiplier,
  type FormEngagementScoreRule,
} from "@/lib/radar/engagement-score"
import type { PublicFormQuestionInput, PublicFormScorePolarity } from "@/lib/public-forms/types"

export type FormSubmissionScoreBreakdown = {
  submissionId: string
  formId: string
  formTitle: string
  submittedAt: string
  scorePercent: number
  scoreBandLabel: string | null
  answers: Array<{
    questionLabel: string
    chosenOptionLabel: string
    chosenOptionScore: number
    chosenOptionPolarity: PublicFormScorePolarity
    questionWeight: number
    contribution: number
  }>
  temperatureMultiplier: number
  baseWeight: number
  finalWeight: number
}

function parseQuestionSnapshot(raw: unknown): PublicFormQuestionInput | null {
  if (!raw || typeof raw !== "object") return null
  const q = raw as Record<string, unknown>
  if (typeof q.title !== "string") return null
  const options = Array.isArray(q.options) ? q.options : []
  return {
    id: typeof q.id === "string" ? q.id : undefined,
    type: q.type as PublicFormQuestionInput["type"],
    title: q.title,
    required: Boolean(q.required),
    scoreWeight: typeof q.scoreWeight === "number" ? q.scoreWeight : 0,
    options: options
      .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
      .map((o) => ({
        id: typeof o.id === "string" ? o.id : undefined,
        label: String(o.label ?? ""),
        value: String(o.value ?? ""),
        score: typeof o.score === "number" ? o.score : 0,
        scorePolarity:
          o.scorePolarity === "negative" ? ("negative" as const) : ("positive" as const),
      })),
  }
}

function answerValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (value == null) return []
  return [String(value)]
}

export class GetFormSubmissionScoreBreakdownUseCase {
  async execute(input: { teamId: string; leadId: string }): Promise<FormSubmissionScoreBreakdown[]> {
    const [submissions, weights, formRuleRows] = await Promise.all([
      publicFormsRepository.findCompletedSubmissionsWithAnswersByLeadId({
        teamId: input.teamId,
        leadId: input.leadId,
      }),
      backofficeRadarEngagementRepository.listWeights(),
      backofficeRadarEngagementRepository.listFormScoreRules(),
    ])

    const formCompletedWeight = weights.find(
      (row) => row.eventType === "form.completed" && row.isActive
    )
    const baseWeight = formCompletedWeight?.weight ?? 25

    const activeRules = formRuleRows.filter((row) => row.isActive)
    const formRules: FormEngagementScoreRule[] =
      activeRules.length > 0
        ? activeRules.map((row) => ({
            minPercent: row.minPercent,
            maxPercent: row.maxPercent,
            multiplier: row.multiplier,
            label: row.label,
            isActive: row.isActive,
          }))
        : DEFAULT_FORM_ENGAGEMENT_SCORE_RULES

    return submissions.map((submission) => {
      const answerRows: FormSubmissionScoreBreakdown["answers"] = []

      for (const answer of submission.answers) {
        const question = parseQuestionSnapshot(answer.questionSnapshot)
        if (!question || question.options.length === 0) continue

        const selected = question.options.filter((option) =>
          answerValues(answer.value).includes(option.value)
        )
        if (selected.length === 0) continue

        for (const option of selected) {
          answerRows.push({
            questionLabel: question.title,
            chosenOptionLabel: option.label,
            chosenOptionScore: Math.max(0, option.score),
            chosenOptionPolarity: option.scorePolarity,
            questionWeight: Math.max(0, question.scoreWeight ?? 0),
            contribution: Math.max(0, question.scoreWeight ?? 0) * signedOptionScore(option),
          })
        }
      }

      const temperatureMultiplier = resolveFormEngagementMultiplier(
        submission.score,
        formRules
      )

      return {
        submissionId: submission.id,
        formId: submission.formId,
        formTitle: submission.form.name,
        submittedAt: (submission.submittedAt ?? submission.createdAt).toISOString(),
        scorePercent: submission.score,
        scoreBandLabel: submission.scoreBandLabel,
        answers: answerRows,
        temperatureMultiplier,
        baseWeight,
        finalWeight: Math.round(baseWeight * temperatureMultiplier),
      }
    })
  }
}

export const getFormSubmissionScoreBreakdownUseCase =
  new GetFormSubmissionScoreBreakdownUseCase()

export async function getFormSubmissionScoreBreakdownOutput(input: {
  teamId: string
  leadId: string
}): Promise<Output> {
  try {
    const formSubmissions = await getFormSubmissionScoreBreakdownUseCase.execute(input)
    return new Output(true, [], [], { formSubmissions })
  } catch (error) {
    console.error("[GetFormSubmissionScoreBreakdownUseCase]", error)
    return new Output(false, [], ["Erro ao buscar breakdown de score de formulários"], null)
  }
}
