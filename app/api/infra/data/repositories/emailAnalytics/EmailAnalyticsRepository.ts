import { prisma } from "@/app/api/infra/data/prisma"

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
  cdpSegmentSlug: string | null
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

export interface IEmailAnalyticsRepository {
  countLogs(where: EmailAnalyticsLogWhere, filter?: "delivered" | "opened" | "clicked" | "bounced" | "complained"): Promise<number>
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
  private buildLogWhere(options: EmailAnalyticsLogWhere) {
    return {
      teamId: options.teamId,
      sentAt: { gte: options.from, lte: options.to },
      ...(options.campaignId && { campaignId: options.campaignId }),
    }
  }

  async countLogs(
    where: EmailAnalyticsLogWhere,
    filter?: "delivered" | "opened" | "clicked" | "bounced" | "complained"
  ): Promise<number> {
    const base = this.buildLogWhere(where)
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
    return prisma.emailCampaignDispatch.findMany({
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
  }

  async findDispatchPreview(options: {
    teamId: string
    campaignId: string
    dispatchId: string
  }) {
    return prisma.emailCampaignDispatch.findFirst({
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
  }
}

export const emailAnalyticsRepository = new EmailAnalyticsRepository()
