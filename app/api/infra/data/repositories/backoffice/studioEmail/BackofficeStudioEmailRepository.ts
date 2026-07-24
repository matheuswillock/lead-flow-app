import { prisma } from "@/app/api/infra/data/prisma"
import { resolveCampaignIdsIncludingSubs } from "@/lib/email/resolve-campaign-query-ids"

export class BackofficeStudioEmailRepository {
  async stampCampaignTree(
    campaignId: string,
    backofficeUserId: string,
    teamId: string
  ): Promise<void> {
    const ids = await resolveCampaignIdsIncludingSubs(teamId, campaignId)
    await prisma.emailCampaign.updateMany({
      where: { id: { in: ids } },
      data: { managedByBackofficeUserId: backofficeUserId },
    })
  }

  async stampContactList(id: string, backofficeUserId: string): Promise<void> {
    await prisma.emailContactList.update({
      where: { id },
      data: { managedByBackofficeUserId: backofficeUserId },
    })
  }

  async stampTemplate(id: string, backofficeUserId: string): Promise<void> {
    await prisma.emailTemplate.update({
      where: { id },
      data: { managedByBackofficeUserId: backofficeUserId },
    })
  }

  async stampImportJob(importId: string, backofficeUserId: string): Promise<void> {
    await prisma.emailImportJob.updateMany({
      where: { importId },
      data: { managedByBackofficeUserId: backofficeUserId },
    })
  }

  async listLogs(options: {
    teamId: string
    page: number
    pageSize: number
    search?: string
    campaignId?: string
    category?: string
    statuses?: string[]
    from?: string
    to?: string
  }) {
    const campaignIds = options.campaignId
      ? await resolveCampaignIdsIncludingSubs(options.teamId, options.campaignId)
      : null

    const where = {
      teamId: options.teamId,
      ...(options.search && {
        OR: [
          { recipientEmail: { contains: options.search, mode: "insensitive" as const } },
          { recipientName: { contains: options.search, mode: "insensitive" as const } },
        ],
      }),
      ...(campaignIds && {
        campaignId: campaignIds.length === 1 ? campaignIds[0] : { in: campaignIds },
      }),
      ...(options.category && { category: options.category as never }),
      ...(options.statuses &&
        options.statuses.length === 1 && { status: options.statuses[0] as never }),
      ...(options.statuses &&
        options.statuses.length > 1 && { status: { in: options.statuses as never[] } }),
      ...((options.from || options.to) && {
        sentAt: {
          ...(options.from && { gte: new Date(options.from) }),
          ...(options.to && { lte: new Date(options.to) }),
        },
      }),
    }

    const [logs, total] = await prisma.$transaction([
      prisma.emailLog.findMany({
        where,
        select: {
          id: true,
          recipientEmail: true,
          recipientName: true,
          subject: true,
          category: true,
          sourceType: true,
          sourceId: true,
          status: true,
          sentAt: true,
          deliveredAt: true,
          openedAt: true,
          clickedAt: true,
          bouncedAt: true,
          campaignId: true,
          dispatchId: true,
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { sentAt: "desc" },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      prisma.emailLog.count({ where }),
    ])

    return { logs, total }
  }

  async getLog(teamId: string, logId: string) {
    return prisma.emailLog.findFirst({
      where: { id: logId, teamId },
      select: {
        id: true,
        recipientEmail: true,
        recipientName: true,
        subject: true,
        category: true,
        sourceType: true,
        sourceId: true,
        status: true,
        sentAt: true,
        deliveredAt: true,
        openedAt: true,
        clickedAt: true,
        bouncedAt: true,
        campaignId: true,
        dispatchId: true,
        campaign: { select: { id: true, name: true } },
        events: {
          select: {
            id: true,
            type: true,
            occurredAt: true,
            metadata: true,
          },
          orderBy: { occurredAt: "asc" },
        },
      },
    })
  }
}

export const backofficeStudioEmailRepository = new BackofficeStudioEmailRepository()
