import type { AnalyticsData, AnalyticsPeriod } from '../context/AnalyticsTypes'
import { addDaysInTz, addMonthsInTz, startOfDayInTz } from '@/lib/dates'

function periodToDateRange(period: AnalyticsPeriod, tz: string): { from: string; to: string } {
  const to = new Date()
  let from = startOfDayInTz(to, tz)
  if (period === '7d') from = startOfDayInTz(addDaysInTz(from, -7, tz), tz)
  else if (period === '30d') from = startOfDayInTz(addDaysInTz(from, -30, tz), tz)
  else if (period === '3m') from = startOfDayInTz(addMonthsInTz(from, -3, tz), tz)
  else from = startOfDayInTz(addMonthsInTz(from, -6, tz), tz)
  return { from: from.toISOString(), to: to.toISOString() }
}

export interface IAnalyticsService {
  getAnalytics(period: AnalyticsPeriod, timezone: string, campaignId?: string): Promise<AnalyticsData>
  getCampaigns(): Promise<Array<{ id: string; name: string }>>
}

export class AnalyticsService implements IAnalyticsService {
  private readonly baseUrl = '/api/v1/email'

  async getAnalytics(period: AnalyticsPeriod, timezone: string, campaignId?: string): Promise<AnalyticsData> {
    const { from, to } = periodToDateRange(period, timezone)
    const params = new URLSearchParams({ from, to })
    if (campaignId) params.set('campaignId', campaignId)
    const res = await fetch(`${this.baseUrl}/analytics?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as AnalyticsData
  }

  async getCampaigns(): Promise<Array<{ id: string; name: string }>> {
    const res = await fetch(`${this.baseUrl}/campaigns?pageSize=100`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.isValid) return []
    type CampaignRaw = { id: string; name: string }
    return (json.result?.campaigns ?? []).map((c: CampaignRaw) => ({ id: c.id, name: c.name }))
  }
}
