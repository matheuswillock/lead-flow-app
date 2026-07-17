import { Output } from "@/lib/output"
import {
  backofficeEmailAnalyticsRepository,
  type BackofficeEmailAnalyticsRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailAnalytics/BackofficeEmailAnalyticsRepository"

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 10000) / 100
}

function buildRates(totals: {
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
}) {
  return {
    deliverabilityRate: safeRate(totals.delivered, totals.sent),
    openRate: safeRate(totals.opened, totals.delivered),
    clickRate: safeRate(totals.clicked, totals.delivered),
    bounceRate: safeRate(totals.bounced, totals.sent),
    complainRate: safeRate(totals.complained, totals.sent),
  }
}

export class BackofficeEmailAnalyticsUseCase {
  constructor(
    private readonly repository: BackofficeEmailAnalyticsRepository = backofficeEmailAnalyticsRepository
  ) {}

  async getAnalytics(options: { from: Date; to: Date; campaignId?: string }): Promise<Output> {
    try {
      const logWhere = { from: options.from, to: options.to, campaignId: options.campaignId }

      const [total, delivered, opened, clicked, bounced, complained] = await Promise.all([
        this.repository.countLogs(logWhere),
        this.repository.countLogs(logWhere, "delivered"),
        this.repository.countLogs(logWhere, "opened"),
        this.repository.countLogs(logWhere, "clicked"),
        this.repository.countLogs(logWhere, "bounced"),
        this.repository.countLogs(logWhere, "complained"),
      ])

      const totals = { sent: total, delivered, opened, clicked, bounced, complained }
      const base = {
        period: { from: options.from, to: options.to },
        totals,
        rates: buildRates(totals),
      }

      if (!options.campaignId) {
        return new Output(true, [], [], base)
      }

      const dispatches = await this.repository.listDispatches({
        campaignId: options.campaignId,
        from: options.from,
        to: options.to,
      })

      return new Output(true, [], [], {
        ...base,
        dispatches: dispatches.map((dispatch) => ({
          ...dispatch,
          rates: buildRates({
            sent: dispatch.totalSent,
            delivered: dispatch.totalDelivered,
            opened: dispatch.totalOpened,
            clicked: dispatch.totalClicked,
            bounced: dispatch.totalBounced,
            complained: dispatch.totalComplained,
          }),
        })),
      })
    } catch (error) {
      console.error("[BackofficeEmailAnalyticsUseCase][getAnalytics]", error)
      return new Output(false, [], ["Erro ao carregar analytics"], null)
    }
  }
}

export const backofficeEmailAnalyticsUseCase = new BackofficeEmailAnalyticsUseCase()
