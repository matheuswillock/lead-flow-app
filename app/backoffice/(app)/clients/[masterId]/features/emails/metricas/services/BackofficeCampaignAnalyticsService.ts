import type {
  AnalyticsData,
  AnalyticsPeriod,
  DispatchPreviewData,
} from "@/app/[supabaseId]/email/campanhas/features/components/analytics/AnalyticsTypes"
import type { StudioEmailCampaignAnalyticsService } from "@/lib/email/studio-email-service-contracts"
import { addDaysInTz, addMonthsInTz, startOfDayInTz } from "@/lib/dates"
import { parseStudioEmailOutput, studioEmailBasePath } from "@/lib/email/backoffice-studio-email-api"

function periodToDateRange(period: AnalyticsPeriod, tz: string): { from: string; to: string } {
  const to = new Date()
  let from = startOfDayInTz(to, tz)
  if (period === "7d") from = startOfDayInTz(addDaysInTz(from, -7, tz), tz)
  else if (period === "30d") from = startOfDayInTz(addDaysInTz(from, -30, tz), tz)
  else if (period === "3m") from = startOfDayInTz(addMonthsInTz(from, -3, tz), tz)
  else from = startOfDayInTz(addMonthsInTz(from, -6, tz), tz)
  return { from: from.toISOString(), to: to.toISOString() }
}

export class BackofficeCampaignAnalyticsService implements StudioEmailCampaignAnalyticsService {
  constructor(
    private readonly masterId: string,
    private readonly teamId: string
  ) {}

  private base(): string {
    return studioEmailBasePath(this.masterId, this.teamId)
  }

  async getAnalytics(
    period: AnalyticsPeriod,
    timezone: string,
    campaignId?: string
  ): Promise<AnalyticsData> {
    const { from, to } = periodToDateRange(period, timezone)
    const params = new URLSearchParams({ from, to })
    if (campaignId) params.set("campaignId", campaignId)
    const response = await fetch(`${this.base()}/analytics?${params}`)
    return parseStudioEmailOutput<AnalyticsData>(response)
  }

  async getDispatchPreview(campaignId: string, dispatchId: string): Promise<DispatchPreviewData> {
    const response = await fetch(
      `${this.base()}/campaigns/${campaignId}/dispatches/${dispatchId}/preview`
    )
    return parseStudioEmailOutput<DispatchPreviewData>(response)
  }
}
