import type {
  AnalyticsData,
  AnalyticsPeriod,
  BackofficeCampaignOption,
} from "../context/BackofficeEmailAnalyticsTypes"

export interface IBackofficeEmailAnalyticsService {
  getAnalytics(period: AnalyticsPeriod, campaignId?: string): Promise<AnalyticsData>
  listCampaignOptions(): Promise<BackofficeCampaignOption[]>
}
