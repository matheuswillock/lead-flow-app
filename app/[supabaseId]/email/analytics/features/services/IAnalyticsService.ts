import type { AnalyticsData, AnalyticsPeriod } from '../context/AnalyticsTypes'

export interface IAnalyticsService {
  getAnalytics(period: AnalyticsPeriod, campaignId?: string): Promise<AnalyticsData>
  getCampaigns(): Promise<Array<{ id: string; name: string }>>
}
