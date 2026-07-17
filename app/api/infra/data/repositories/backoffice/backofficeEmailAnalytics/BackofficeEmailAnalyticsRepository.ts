import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeEmailAnalyticsDispatchRecord,
  BackofficeEmailAnalyticsLogWhere,
  IBackofficeEmailAnalyticsRepository,
} from "./IBackofficeEmailAnalyticsRepository"

export class BackofficeEmailAnalyticsRepository implements IBackofficeEmailAnalyticsRepository {
  private buildLogWhere(options: BackofficeEmailAnalyticsLogWhere) {
    return {
      createdAt: { gte: options.from, lte: options.to },
      ...(options.campaignId && { campaignId: options.campaignId }),
    }
  }

  async countLogs(
    where: BackofficeEmailAnalyticsLogWhere,
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

    return prisma.backofficeEmailLog.count({
      where: { ...base, ...timestampFilter },
    })
  }

  async listDispatches(options: {
    campaignId: string
    from: Date
    to: Date
  }): Promise<BackofficeEmailAnalyticsDispatchRecord[]> {
    return prisma.backofficeEmailCampaignDispatch.findMany({
      where: {
        campaignId: options.campaignId,
        createdAt: { gte: options.from, lte: options.to },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        dispatchNumber: true,
        templateSubjectSnapshot: true,
        createdAt: true,
        totalRecipients: true,
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalBounced: true,
        totalComplained: true,
        status: true,
      },
    })
  }
}

export const backofficeEmailAnalyticsRepository = new BackofficeEmailAnalyticsRepository()
