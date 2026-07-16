import { Output } from "@/lib/output"
import {
  emailAnalyticsRepository,
  type IEmailAnalyticsRepository,
} from "@/app/api/infra/data/repositories/emailAnalytics/EmailAnalyticsRepository"

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
    openRate: safeRate(totals.opened, totals.sent),
    clickRate: safeRate(totals.clicked, totals.sent),
    bounceRate: safeRate(totals.bounced, totals.sent),
    complainRate: safeRate(totals.complained, totals.sent),
  }
}

export class EmailAnalyticsUseCase {
  constructor(private readonly repository: IEmailAnalyticsRepository = emailAnalyticsRepository) {}

  async getAnalytics(options: {
    teamId: string
    from: Date
    to: Date
    campaignId?: string
  }): Promise<Output> {
    try {
      const logWhere = {
        teamId: options.teamId,
        from: options.from,
        to: options.to,
        campaignId: options.campaignId,
      }

      const [total, delivered, opened, clicked, bounced, complained] = await Promise.all([
        this.repository.countLogs(logWhere),
        this.repository.countLogs(logWhere, "delivered"),
        this.repository.countLogs(logWhere, "opened"),
        this.repository.countLogs(logWhere, "clicked"),
        this.repository.countLogs(logWhere, "bounced"),
        this.repository.countLogs(logWhere, "complained"),
      ])

      const totals = {
        sent: total,
        delivered,
        opened,
        clicked,
        bounced,
        complained,
      }

      const base = {
        period: { from: options.from, to: options.to },
        totals,
        rates: buildRates(totals),
      }

      if (!options.campaignId) {
        return new Output(true, [], [], base)
      }

      const dispatches = await this.repository.listDispatches({
        teamId: options.teamId,
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
      console.error("[EmailAnalyticsUseCase][getAnalytics]", error)
      return new Output(false, [], ["Erro ao carregar analytics"], null)
    }
  }

  async getDispatchPreview(options: {
    teamId: string
    campaignId: string
    dispatchId: string
  }): Promise<Output> {
    try {
      const dispatch = await this.repository.findDispatchPreview(options)

      if (!dispatch) {
        return new Output(false, [], ["Disparo não encontrado"], null)
      }

      return new Output(true, [], [], {
        subject: dispatch.templateSubject,
        html: dispatch.templateHtml,
        templateVersionNumber: dispatch.templateVersionNumber,
        templateName: dispatch.templateName,
      })
    } catch (error) {
      console.error("[EmailAnalyticsUseCase][getDispatchPreview]", error)
      return new Output(false, [], ["Erro ao carregar prévia do disparo"], null)
    }
  }
}

export const emailAnalyticsUseCase = new EmailAnalyticsUseCase()
