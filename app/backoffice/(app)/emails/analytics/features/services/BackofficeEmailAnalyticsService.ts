import { addDaysInTz, addMonthsInTz, startOfDayInTz } from "@/lib/dates"
import { DEFAULT_TZ } from "@/lib/dates/DEFAULT_TZ"
import type {
  AnalyticsData,
  AnalyticsPeriod,
  BackofficeCampaignOption,
} from "../context/BackofficeEmailAnalyticsTypes"
import type { IBackofficeEmailAnalyticsService } from "./IBackofficeEmailAnalyticsService"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface BackofficeApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as BackofficeApiOutput<T> | null
  if (!response.ok || !json || !json.isValid) {
    const message = json?.errorMessages?.[0] ?? `HTTP ${response.status}`
    throw new Error(message)
  }
  return json.result
}

function periodToDateRange(period: AnalyticsPeriod): { from: string; to: string } {
  const to = new Date()
  let from = startOfDayInTz(to, DEFAULT_TZ)
  if (period === "7d") from = startOfDayInTz(addDaysInTz(from, -7, DEFAULT_TZ), DEFAULT_TZ)
  else if (period === "30d") from = startOfDayInTz(addDaysInTz(from, -30, DEFAULT_TZ), DEFAULT_TZ)
  else if (period === "3m") from = startOfDayInTz(addMonthsInTz(from, -3, DEFAULT_TZ), DEFAULT_TZ)
  else from = startOfDayInTz(addMonthsInTz(from, -6, DEFAULT_TZ), DEFAULT_TZ)
  return { from: from.toISOString(), to: to.toISOString() }
}

export class BackofficeEmailAnalyticsService implements IBackofficeEmailAnalyticsService {
  async getAnalytics(period: AnalyticsPeriod, campaignId?: string): Promise<AnalyticsData> {
    const { from, to } = periodToDateRange(period)
    const params = new URLSearchParams({ from, to })
    if (campaignId) params.set("campaignId", campaignId)
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/email-campaigns/analytics?${params}`, {
      cache: "no-store",
    })
    return parseOutput<AnalyticsData>(response)
  }

  async listCampaignOptions(): Promise<BackofficeCampaignOption[]> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/email-campaigns`, {
      method: "GET",
      cache: "no-store",
    })
    const campaigns = await parseOutput<Array<{ id: string; name: string }>>(response)
    return campaigns.map((c) => ({ id: c.id, name: c.name }))
  }
}
