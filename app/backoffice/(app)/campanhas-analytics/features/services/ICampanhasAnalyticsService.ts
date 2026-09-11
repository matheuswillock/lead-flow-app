import type { Output } from "@/lib/output"
import type { CampaignAnalyticsCsvDataset, CampaignAnalyticsQueryParams } from "../context/CampanhasAnalyticsTypes"

export type CampaignAnalyticsDispatchesParams = CampaignAnalyticsQueryParams & {
  page: number
  pageSize: number
}

export type CampaignAnalyticsExportParams = CampaignAnalyticsQueryParams & {
  dataset: CampaignAnalyticsCsvDataset
}

export type CampaignAnalyticsExportResult = {
  blob: Blob
  filename: string
}

export interface ICampanhasAnalyticsService {
  getSummary(params: CampaignAnalyticsQueryParams): Promise<Output>
  getDispatches(params: CampaignAnalyticsDispatchesParams): Promise<Output>
  getTeamsSeries(params: CampaignAnalyticsQueryParams): Promise<Output>
  getTemplates(params: CampaignAnalyticsQueryParams): Promise<Output>
  getFormsFunnel(params: CampaignAnalyticsQueryParams): Promise<Output>
  exportCsv(params: CampaignAnalyticsExportParams): Promise<CampaignAnalyticsExportResult>
}
