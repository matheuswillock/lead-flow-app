import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export type DeliverabilityAnalyticsFilters = {
  from: Date
  to: Date
  senderDomain?: string
  recipientProvider?: string
  campaignId?: string
}

export interface IEmailDeliverabilityAnalyticsRepository {
  listTeamIds(): Promise<string[]>
  rebuildDailyMetrics(teamId: string, from: Date, to: Date): Promise<number>
  deleteExpiredMetrics(before: Date): Promise<number>
}

export class EmailDeliverabilityAnalyticsRepository implements IEmailDeliverabilityAnalyticsRepository {
  async listTeamIds(): Promise<string[]> {
    const rows = await prisma.emailTeamSettings.findMany({ select: { teamId: true } })
    return rows.map((row) => row.teamId)
  }
  async deleteExpiredMetrics(before: Date): Promise<number> {
    const deleted = await prisma.emailDeliverabilityDailyMetric.deleteMany({
      where: { metricDate: { lt: before } },
    })
    return deleted.count
  }
  async rebuildDailyMetrics(teamId: string, from: Date, to: Date): Promise<number> {
    const { logs, senderDomain } = await this.listCampaignLogs(teamId, { from, to })
    const domain = senderDomain?.trim().toLowerCase() || "desconhecido"
    const groups = new Map<string, {
      metricDate: Date
      recipientProvider: string
      campaignKey: string
      sent: number
      delivered: number
      hardBounced: number
      humanOpened: number
      clicked: number
      complained: number
      suppressed: number
    }>()
    for (const log of logs) {
      const metricDate = new Date(Date.UTC(log.createdAt.getUTCFullYear(), log.createdAt.getUTCMonth(), log.createdAt.getUTCDate()))
      const recipientProvider = resolveRecipientProvider(log.recipientEmail)
      const campaignKey = log.campaignId ?? "__all__"
      const key = `${metricDate.toISOString()}|${recipientProvider}|${campaignKey}`
      const current = groups.get(key) ?? { metricDate, recipientProvider, campaignKey, sent: 0, delivered: 0, hardBounced: 0, humanOpened: 0, clicked: 0, complained: 0, suppressed: 0 }
      current.sent += log.sentAt ? 1 : 0
      current.delivered += log.deliveredAt ? 1 : 0
      current.hardBounced += log.bouncedAt ? 1 : 0
      current.humanOpened += log.humanOpenedAt ? 1 : 0
      current.clicked += log.clickedAt ? 1 : 0
      current.complained += log.complainedAt ? 1 : 0
      current.suppressed += log.status === "suppressed" ? 1 : 0
      groups.set(key, current)
    }
    await prisma.$transaction(async (tx) => {
      await tx.emailDeliverabilityDailyMetric.deleteMany({ where: { teamId, metricDate: { gte: from, lte: to } } })
      if (groups.size > 0) await tx.emailDeliverabilityDailyMetric.createMany({ data: [...groups.values()].map((metric) => ({ teamId, senderDomain: domain, softBounced: 0, ...metric })) })
    })
    return groups.size
  }
  async listDailyMetrics(teamId: string, filters: DeliverabilityAnalyticsFilters) {
    try {
      return await prisma.emailDeliverabilityDailyMetric.findMany({
        where: {
          teamId,
          metricDate: { gte: filters.from, lte: filters.to },
          ...(filters.senderDomain ? { senderDomain: filters.senderDomain } : {}),
          ...(filters.recipientProvider ? { recipientProvider: filters.recipientProvider } : {}),
          ...(filters.campaignId ? { campaignKey: filters.campaignId } : {}),
        },
        orderBy: { metricDate: "asc" },
      })
    } catch (error) {
      if (isMissingTableError(error)) return []
      throw error
    }
  }

  async listCampaignLogs(teamId: string, filters?: DeliverabilityAnalyticsFilters) {
    const settingsPromise = prisma.emailTeamSettings.findUnique({
      where: { teamId },
      select: { resendDomainName: true },
    })
    const logs: Array<{
      id: string
      campaignId: string | null
      recipientEmail: string
      status: string
      createdAt: Date
      sentAt: Date | null
      deliveredAt: Date | null
      humanOpenedAt: Date | null
      clickedAt: Date | null
      bouncedAt: Date | null
      complainedAt: Date | null
    }> = []
    let cursor: string | undefined

    do {
      const page = await prisma.emailLog.findMany({
        where: {
          teamId,
          category: "campaign",
          ...(filters ? { createdAt: { gte: filters.from, lte: filters.to } } : {}),
          ...(filters?.campaignId ? { campaignId: filters.campaignId } : {}),
        },
        orderBy: { id: "asc" },
        take: 5000,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          campaignId: true,
          recipientEmail: true,
          status: true,
          createdAt: true,
          sentAt: true,
          deliveredAt: true,
          humanOpenedAt: true,
          clickedAt: true,
          bouncedAt: true,
          complainedAt: true,
        },
      })
      logs.push(...page)
      cursor = page.length === 5000 ? page.at(-1)?.id : undefined
    } while (cursor)

    const settings = await settingsPromise
    return { logs, senderDomain: settings?.resendDomainName ?? null }
  }
}

function resolveRecipientProvider(email: string): string {
  const domain = email.split("@")[1]?.trim().toLowerCase()
  if (!domain) return "outros"
  if (domain === "gmail.com" || domain === "googlemail.com") return "gmail"
  if (domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com") return "microsoft"
  if (domain === "yahoo.com" || domain === "yahoo.com.br") return "yahoo"
  return domain
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021"
}

export const emailDeliverabilityAnalyticsRepository = new EmailDeliverabilityAnalyticsRepository()
