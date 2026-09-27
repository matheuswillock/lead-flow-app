import { buildDeliverabilityBreakdown } from "@/lib/email/deliverability-breakdown"
import { emailDeliverabilityAnalyticsRepository } from "@/app/api/infra/data/repositories/emailDeliverability/EmailDeliverabilityAnalyticsRepository"

function resolveRecipientProvider(email: string): string | null {
  const domain = email.split("@")[1]?.trim().toLowerCase()
  if (!domain) return null
  if (["gmail.com", "googlemail.com"].includes(domain)) return "gmail"
  if (["outlook.com", "hotmail.com", "live.com"].includes(domain)) return "microsoft"
  if (["yahoo.com", "yahoo.com.br"].includes(domain)) return "yahoo"
  return domain
}

export class EmailDeliverabilityAnalyticsService {
  async getBreakdown(teamId: string) {
    const { logs, senderDomain } = await emailDeliverabilityAnalyticsRepository.listCampaignLogs(teamId)
    return buildDeliverabilityBreakdown(logs.map((log) => ({ senderDomain, recipientProvider: resolveRecipientProvider(log.recipientEmail), status: log.status })))
  }
}

export const emailDeliverabilityAnalyticsService = new EmailDeliverabilityAnalyticsService()
