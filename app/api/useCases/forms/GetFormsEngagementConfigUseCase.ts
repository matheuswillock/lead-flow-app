import { Output } from "@/lib/output"
import { backofficeRadarEngagementRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeRadarEngagement/BackofficeRadarEngagementRepository"
import {
  DEFAULT_ENGAGEMENT_CONFIG,
  DEFAULT_FORM_ENGAGEMENT_SCORE_RULES,
} from "@/lib/radar/engagement-score"

export class GetFormsEngagementConfigUseCase {
  async execute(): Promise<Output> {
    try {
      const [weights, configRow, formRuleRows] = await Promise.all([
        backofficeRadarEngagementRepository.listWeights(),
        backofficeRadarEngagementRepository.getActiveConfig(),
        backofficeRadarEngagementRepository.listFormScoreRules(),
      ])

      const formCompletedWeight = weights.find(
        (row) => row.eventType === "form.completed" && row.isActive
      )
      const formCompletedBaseWeight = formCompletedWeight?.weight ?? 25

      const activeRules = formRuleRows.filter((row) => row.isActive)
      const formEngagementScoreRules =
        activeRules.length > 0
          ? activeRules.map((row) => ({
              minPercent: row.minPercent,
              maxPercent: row.maxPercent,
              multiplier: row.multiplier,
              label: row.label,
              isActive: row.isActive,
            }))
          : DEFAULT_FORM_ENGAGEMENT_SCORE_RULES

      const engagementConfig = configRow
        ? {
            windowRecentDays: configRow.windowRecentDays,
            windowMidDays: configRow.windowMidDays,
            windowOldDays: configRow.windowOldDays,
            recentMultiplier: configRow.recentMultiplier,
            oldMultiplier: configRow.oldMultiplier,
            hotThreshold: configRow.hotThreshold,
            warmThreshold: configRow.warmThreshold,
            lukewarmThreshold: configRow.lukewarmThreshold,
          }
        : DEFAULT_ENGAGEMENT_CONFIG

      return new Output(true, [], [], {
        formCompletedBaseWeight,
        formEngagementScoreRules,
        engagementConfig,
      })
    } catch (error) {
      console.error("[GetFormsEngagementConfigUseCase][execute]", error)
      return new Output(false, [], ["Erro ao carregar configuração de engajamento"], null)
    }
  }
}

export const getFormsEngagementConfigUseCase = new GetFormsEngagementConfigUseCase()
