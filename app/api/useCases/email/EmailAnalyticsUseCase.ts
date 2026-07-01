import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"

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

export class EmailAnalyticsUseCase {
  async getAnalytics(options: {
    teamId: string
    from: Date
    to: Date
    campaignId?: string
  }): Promise<Output> {
    try {
      const logWhere = {
        teamId: options.teamId,
        sentAt: { gte: options.from, lte: options.to },
        ...(options.campaignId && { campaignId: options.campaignId }),
      }

      const [total, delivered, opened, clicked, bounced, complained] = await Promise.all([
        prisma.emailLog.count({ where: logWhere }),
        prisma.emailLog.count({ where: { ...logWhere, deliveredAt: { not: null } } }),
        prisma.emailLog.count({ where: { ...logWhere, openedAt: { not: null } } }),
        prisma.emailLog.count({ where: { ...logWhere, clickedAt: { not: null } } }),
        prisma.emailLog.count({ where: { ...logWhere, bouncedAt: { not: null } } }),
        prisma.emailLog.count({ where: { ...logWhere, complainedAt: { not: null } } }),
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

      const dispatches = await prisma.emailCampaignDispatch.findMany({
        where: {
          teamId: options.teamId,
          campaignId: options.campaignId,
          dispatchedAt: { gte: options.from, lte: options.to },
        },
        select: {
          id: true,
          dispatchNumber: true,
          templateName: true,
          templateVersionNumber: true,
          templateSubject: true,
          contactListName: true,
          cdpSegmentSlug: true,
          dispatchedAt: true,
          totalRecipients: true,
          totalSent: true,
          totalDelivered: true,
          totalOpened: true,
          totalClicked: true,
          totalBounced: true,
          totalComplained: true,
          status: true,
        },
        orderBy: { dispatchNumber: "desc" },
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
      const dispatch = await prisma.emailCampaignDispatch.findFirst({
        where: {
          id: options.dispatchId,
          campaignId: options.campaignId,
          teamId: options.teamId,
        },
        select: {
          templateSubject: true,
          templateHtml: true,
          templateVersionNumber: true,
          templateName: true,
        },
      })

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
