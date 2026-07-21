import { prisma } from "@/app/api/infra/data/prisma"
import { resolveCampaignIdsIncludingSubs } from "@/lib/email/resolve-campaign-query-ids"

export type EmailAnalyticsLogWhere = {
  teamId: string
  from: Date
  to: Date
  campaignId?: string
}

export type EmailAnalyticsDispatchRecord = {
  id: string
  dispatchNumber: number
  templateName: string
  templateVersionNumber: number
  templateSubject: string
  contactListName: string | null
  radarSegmentSlug: string | null
  dispatchedAt: Date
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalComplained: number
  status: string
}

export type EmailAnalyticsLogFilter =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"
  | "delivery_delayed"
  | "unsubscribed"
  | "suppressed"

export interface IEmailAnalyticsRepository {
  countLogs(where: EmailAnalyticsLogWhere, filter?: EmailAnalyticsLogFilter): Promise<number>
  listDispatches(options: {
    teamId: string
    campaignId: string
    from: Date
    to: Date
  }): Promise<EmailAnalyticsDispatchRecord[]>
  findDispatchPreview(options: {
    teamId: string
    campaignId: string
    dispatchId: string
  }): Promise<{
    templateSubject: string
    templateHtml: string
    templateVersionNumber: number
    templateName: string
  } | null>
}

export class EmailAnalyticsRepository implements IEmailAnalyticsRepository {
  private async resolveCampaignFilter(teamId: string, campaignId?: string) {
    if (!campaignId) return undefined
    const campaignIds = await resolveCampaignIdsIncludingSubs(teamId, campaignId)
    return campaignIds.length === 1 ? campaignIds[0] : { in: campaignIds }
  }

  private async buildLogWhere(options: EmailAnalyticsLogWhere) {
    const campaignFilter = await this.resolveCampaignFilter(options.teamId, options.campaignId)
    return {
      teamId: options.teamId,
      sentAt: { gte: options.from, lte: options.to },
      ...(campaignFilter && { campaignId: campaignFilter }),
    }
  }

  async countLogs(
    where: EmailAnalyticsLogWhere,
    filter?: EmailAnalyticsLogFilter
  ): Promise<number> {
    const base = await this.buildLogWhere(where)
    const timestampFilter =
      filter === "delivered"
        ? { deliveredAt: { not: null as Date | null } }
        : filter === "opened"
          ? { openedAt: { not: null as Date | null } }
          : filter === "clicked"
            ? { clickedAt: { not: null as Date | null } }
            : filter === "bounced"
              ? { bouncedAt: { not: null as Date | null } }
              : filter === "complained"
                ? { complainedAt: { not: null as Date | null } }
                : filter === "failed"
                  ? { status: "failed" as const }
                  : filter === "suppressed"
                    ? { status: "suppressed" as const }
                    : filter === "delivery_delayed"
                      ? { events: { some: { type: "delivery_delayed" as const } } }
                      : filter === "unsubscribed"
                        ? { events: { some: { type: "unsubscribed" as const } } }
                        : {}

    return prisma.emailLog.count({
      where: { ...base, ...timestampFilter },
    })
  }

  async listDispatches(options: {
    teamId: string
    campaignId: string
    from: Date
    to: Date
  }) {
    const campaignFilter = await this.resolveCampaignFilter(options.teamId, options.campaignId)
    return prisma.emailCampaignDispatch.findMany({
      where: {
        teamId: options.teamId,
        ...(campaignFilter && { campaignId: campaignFilter }),
        dispatchedAt: { gte: options.from, lte: options.to },
      },
      select: {
        id: true,
        dispatchNumber: true,
        templateName: true,
        templateVersionNumber: true,
        templateSubject: true,
        contactListName: true,
        radarSegmentSlug: true,
        dispatchedAt: true,
        totalRecipients: true,
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalBounced: true,
        totalComplained: true,
        status: true,
        errorMessage: true,
      },
      orderBy: { dispatchNumber: "desc" },
    })
  }

  async findDispatchPreview(options: {
    teamId: string
    campaignId: string
    dispatchId: string
  }) {
    const campaignFilter = await this.resolveCampaignFilter(options.teamId, options.campaignId)
    return prisma.emailCampaignDispatch.findFirst({
      where: {
        id: options.dispatchId,
        ...(campaignFilter && { campaignId: campaignFilter }),
        teamId: options.teamId,
      },
      select: {
        templateSubject: true,
        templateHtml: true,
        templateVersionNumber: true,
        templateName: true,
      },
    })
  }
}

export const emailAnalyticsRepository = new EmailAnalyticsRepository()
