import { Output } from "@/lib/output"
import {
  emailAnalyticsRepository,
  type IEmailAnalyticsRepository,
} from "@/app/api/infra/data/repositories/emailAnalytics/EmailAnalyticsRepository"
import { buildRates } from "@/lib/email/analytics-rates"
import {
  aggregateTemplateGroups,
  rankTopTemplates,
} from "@/lib/email/template-ranking"

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

      const [total, delivered, opened, clicked, bounced, complained, failed, deliveryDelayed, unsubscribed, suppressed] = await Promise.all([
        this.repository.countLogs(logWhere),
        this.repository.countLogs(logWhere, "delivered"),
        this.repository.countLogs(logWhere, "opened"),
        this.repository.countLogs(logWhere, "clicked"),
        this.repository.countLogs(logWhere, "bounced"),
        this.repository.countLogs(logWhere, "complained"),
        this.repository.countLogs(logWhere, "failed"),
        this.repository.countLogs(logWhere, "delivery_delayed"),
        this.repository.countLogs(logWhere, "unsubscribed"),
        this.repository.countLogs(logWhere, "suppressed"),
      ])

      const totals = {
        sent: total,
        delivered,
        opened,
        clicked,
        bounced,
        complained,
        failed,
        deliveryDelayed,
        unsubscribed,
        suppressed,
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

  async getTopTemplates(options: {
    teamId: string
    from: Date
    to: Date
  }): Promise<Output> {
    try {
      const rows = await this.repository.listTemplateVersionMetrics(options)
      const ranking = rankTopTemplates(aggregateTemplateGroups(rows))

      return new Output(true, [], [], {
        period: { from: options.from, to: options.to },
        ...ranking,
      })
    } catch (error) {
      console.error("[EmailAnalyticsUseCase][getTopTemplates]", error)
      return new Output(false, [], ["Erro ao carregar ranking de templates"], null)
    }
  }
}

export const emailAnalyticsUseCase = new EmailAnalyticsUseCase()
