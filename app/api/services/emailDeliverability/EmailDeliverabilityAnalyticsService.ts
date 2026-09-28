import {
  emailDeliverabilityAnalyticsRepository,
  type DeliverabilityAnalyticsFilters,
} from "@/app/api/infra/data/repositories/emailDeliverability/EmailDeliverabilityAnalyticsRepository"

type Metric = {
  metricDate: Date
  senderDomain: string
  recipientProvider: string
  sent: number
  delivered: number
  hardBounced: number
  softBounced: number
  complained: number
  humanOpened: number
  clicked: number
  suppressed: number
}

export class EmailDeliverabilityAnalyticsService {
  async getDashboard(teamId: string, filters: DeliverabilityAnalyticsFilters) {
    const persisted = await emailDeliverabilityAnalyticsRepository.listDailyMetrics(teamId, filters)
    const metrics = persisted.length > 0
      ? persisted
      : await this.buildFallbackMetrics(teamId, filters)
    return buildDeliverabilityDashboard(metrics)
  }

  async getBreakdown(teamId: string) {
    const now = new Date()
    const from = new Date(now.getTime() - 30 * 86_400_000)
    return (await this.getDashboard(teamId, { from, to: now })).breakdown
  }

  private async buildFallbackMetrics(
    teamId: string,
    filters: DeliverabilityAnalyticsFilters
  ): Promise<Metric[]> {
    const { logs, senderDomain } = await emailDeliverabilityAnalyticsRepository.listCampaignLogs(
      teamId,
      filters
    )
    const groups = new Map<string, Metric>()
    for (const log of logs) {
      const domain = senderDomain?.trim().toLowerCase() || "desconhecido"
      const provider = resolveRecipientProvider(log.recipientEmail) ?? "outros"
      if (filters.senderDomain && filters.senderDomain !== domain) continue
      if (filters.recipientProvider && filters.recipientProvider !== provider) continue
      const metricDate = toUtcDate(log.createdAt)
      const key = `${metricDate.toISOString()}|${domain}|${provider}`
      const metric = groups.get(key) ?? emptyMetric(metricDate, domain, provider)
      metric.sent += log.sentAt ? 1 : 0
      metric.delivered += log.deliveredAt ? 1 : 0
      metric.hardBounced += log.bouncedAt ? 1 : 0
      metric.complained += log.complainedAt ? 1 : 0
      metric.humanOpened += log.humanOpenedAt ? 1 : 0
      metric.clicked += log.clickedAt ? 1 : 0
      metric.suppressed += log.status === "suppressed" ? 1 : 0
      groups.set(key, metric)
    }
    return [...groups.values()]
  }
}

export function buildDeliverabilityDashboard(metrics: Metric[]) {
  const summary = sumMetrics(metrics)
  const seriesGroups = groupMetrics(metrics, (metric) => metric.metricDate.toISOString().slice(0, 10))
  const domainGroups = groupMetrics(metrics, (metric) => metric.senderDomain)
  const providerGroups = groupMetrics(metrics, (metric) => metric.recipientProvider)
  return {
    summary: withRates(summary),
    series: [...seriesGroups.entries()].map(([date, rows]) => ({ date, ...withRates(sumMetrics(rows)) })),
    domains: [...domainGroups.entries()].map(([senderDomain, rows]) => ({ senderDomain, ...withRates(sumMetrics(rows)) })),
    providers: [...providerGroups.entries()].map(([recipientProvider, rows]) => ({ recipientProvider, ...withRates(sumMetrics(rows)) })),
    breakdown: metrics.map((metric) => ({
      key: `${metric.senderDomain}|${metric.recipientProvider}`,
      senderDomain: metric.senderDomain,
      recipientProvider: metric.recipientProvider,
      total: metric.sent,
      delivered: metric.delivered,
      bounced: metric.hardBounced + metric.softBounced,
      complained: metric.complained,
      failed: Math.max(0, metric.sent - metric.delivered - metric.hardBounced - metric.softBounced),
    })),
  }
}

function groupMetrics(metrics: Metric[], key: (metric: Metric) => string) {
  const groups = new Map<string, Metric[]>()
  for (const metric of metrics) groups.set(key(metric), [...(groups.get(key(metric)) ?? []), metric])
  return groups
}

function sumMetrics(metrics: Metric[]) {
  return metrics.reduce((total, metric) => ({
    sent: total.sent + metric.sent,
    delivered: total.delivered + metric.delivered,
    hardBounced: total.hardBounced + metric.hardBounced,
    softBounced: total.softBounced + metric.softBounced,
    complained: total.complained + metric.complained,
    humanOpened: total.humanOpened + metric.humanOpened,
    clicked: total.clicked + metric.clicked,
    suppressed: total.suppressed + metric.suppressed,
  }), emptyTotals())
}

function withRates(total: ReturnType<typeof emptyTotals>) {
  const denominator = Math.max(1, total.sent)
  return {
    ...total,
    deliveryRate: total.delivered / denominator,
    bounceRate: (total.hardBounced + total.softBounced) / denominator,
    complaintRate: total.complained / denominator,
    humanOpenRate: total.humanOpened / denominator,
    clickRate: total.clicked / denominator,
  }
}

function emptyTotals() {
  return { sent: 0, delivered: 0, hardBounced: 0, softBounced: 0, complained: 0, humanOpened: 0, clicked: 0, suppressed: 0 }
}

function emptyMetric(metricDate: Date, senderDomain: string, recipientProvider: string): Metric {
  return { metricDate, senderDomain, recipientProvider, ...emptyTotals() }
}

function resolveRecipientProvider(email: string): string | null {
  const domain = email.split("@")[1]?.trim().toLowerCase()
  if (!domain) return null
  if (["gmail.com", "googlemail.com"].includes(domain)) return "gmail"
  if (["outlook.com", "hotmail.com", "live.com"].includes(domain)) return "microsoft"
  if (["yahoo.com", "yahoo.com.br"].includes(domain)) return "yahoo"
  return domain
}

function toUtcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

export const emailDeliverabilityAnalyticsService = new EmailDeliverabilityAnalyticsService()
