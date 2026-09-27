import { prisma } from "@/app/api/infra/data/prisma"

export class EmailDeliverabilityAnalyticsRepository {
  async listCampaignLogs(teamId: string) {
    const [logs, settings] = await Promise.all([
      prisma.emailLog.findMany({ where: { teamId, category: "campaign" }, orderBy: { createdAt: "desc" }, take: 5000, select: { recipientEmail: true, status: true } }),
      prisma.emailTeamSettings.findUnique({ where: { teamId }, select: { resendDomainName: true } }),
    ])
    return { logs, senderDomain: settings?.resendDomainName ?? null }
  }
}

export const emailDeliverabilityAnalyticsRepository = new EmailDeliverabilityAnalyticsRepository()
