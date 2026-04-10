import type { AnalyticsData, AnalyticsPeriod } from '../context/AnalyticsTypes'

function periodToDateRange(period: AnalyticsPeriod): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  if (period === '7d') from.setDate(from.getDate() - 7)
  else if (period === '30d') from.setDate(from.getDate() - 30)
  else if (period === '3m') from.setDate(from.getDate() - 90)
  else from.setDate(from.getDate() - 180)
  return { from: from.toISOString(), to: to.toISOString() }
}

export interface IAnalyticsService {
  getAnalytics(period: AnalyticsPeriod, campaignId?: string): Promise<AnalyticsData>
  getCampaigns(): Promise<Array<{ id: string; name: string }>>
}

export class AnalyticsService implements IAnalyticsService {
  private readonly baseUrl = '/api/v1/email'

  async getAnalytics(period: AnalyticsPeriod, campaignId?: string): Promise<AnalyticsData> {
    const { from, to } = periodToDateRange(period)
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
