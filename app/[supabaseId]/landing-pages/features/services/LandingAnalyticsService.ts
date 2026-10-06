import { API_CLIENT_BASE } from "@/lib/route-map"

export type LandingAnalyticsFilters = {
  from: string
  to: string
  timezone: string
  landingPageId?: string
  campaignId?: string
  templateSlug?: string
  formId?: string
  publicationId?: string
}

export type LandingAnalyticsSummary = {
  period: { from: string; to: string }
  totals: Record<string, number>
  uniqueVisitors: number
  returningVisitors: number
  byEventType: Array<{ eventType: string; count: number }>
}

export class LandingAnalyticsService {
  async getSummary(teamId: string, filters: LandingAnalyticsFilters, headers: HeadersInit): Promise<LandingAnalyticsSummary> {
    const params = new URLSearchParams({ from: filters.from, to: filters.to, timezone: filters.timezone })
    for (const [key, value] of Object.entries(filters)) {
      if (key !== "from" && key !== "to" && key !== "timezone" && value) params.set(key, value)
    }
    const response = await fetch(`${API_CLIENT_BASE}/teams/${teamId}/landing-pages/analytics?${params}`, { headers })
    const payload = await response.json()
    if (!response.ok || !payload.isValid) throw new Error(payload.errorMessages?.join(", ") ?? "Não foi possível carregar o analytics")
    return payload.result as LandingAnalyticsSummary
  }

  buildCsv(summary: LandingAnalyticsSummary): string {
    const rows = [["evento", "quantidade"], ...summary.byEventType.map((item) => [item.eventType, String(item.count)])]
    return rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n")
  }
}

export const landingAnalyticsService = new LandingAnalyticsService()
