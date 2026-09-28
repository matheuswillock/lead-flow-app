import { Output } from "@/lib/output"
import { emailDeliverabilityAnalyticsRepository, type IEmailDeliverabilityAnalyticsRepository } from "@/app/api/infra/data/repositories/emailDeliverability/EmailDeliverabilityAnalyticsRepository"

export class RebuildEmailDeliverabilityMetricsUseCase {
  constructor(private readonly repository: IEmailDeliverabilityAnalyticsRepository = emailDeliverabilityAnalyticsRepository) {}

  async execute(now = new Date()): Promise<Output> {
    try {
      const from = new Date(now.getTime() - 366 * 86_400_000)
      const teamIds = await this.repository.listTeamIds()
      let metrics = 0
      for (const teamId of teamIds) {
        metrics += await this.repository.rebuildDailyMetrics(teamId, from, now)
      }
      const expired = await this.repository.deleteExpiredMetrics(from)
      return new Output(true, ["Métricas de deliverability reconstruídas"], [], { teams: teamIds.length, metrics, expired })
    } catch (error) {
      console.error("[RebuildEmailDeliverabilityMetricsUseCase][execute]", error)
      return new Output(false, [], ["Falha ao reconstruir métricas de deliverability"], null)
    }
  }
}

export const rebuildEmailDeliverabilityMetricsUseCase = new RebuildEmailDeliverabilityMetricsUseCase()
