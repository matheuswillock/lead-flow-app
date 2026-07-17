import type {
  BackofficeLeadQuickEntryFormData,
  BackofficeOptInCampaignInfo,
} from "../context/BackofficeLeadQuickEntryTypes"

export interface IBackofficeLeadQuickEntryService {
  getOptInCampaign(): Promise<BackofficeOptInCampaignInfo | null>
  submit(data: BackofficeLeadQuickEntryFormData): Promise<void>
}
