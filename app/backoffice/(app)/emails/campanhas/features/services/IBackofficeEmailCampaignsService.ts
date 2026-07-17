import type {
  BackofficeEmailCampaignDispatchItem,
  BackofficeEmailCampaignItem,
  BackofficeEmailContactListOption,
  BackofficeEmailTemplateOption,
  CreateBackofficeEmailCampaignFormData,
} from "../context/BackofficeEmailCampaignsTypes"

export interface IBackofficeEmailCampaignsService {
  listCampaigns(): Promise<BackofficeEmailCampaignItem[]>
  createCampaign(data: CreateBackofficeEmailCampaignFormData): Promise<BackofficeEmailCampaignItem>
  updateCampaign(
    id: string,
    data: Partial<CreateBackofficeEmailCampaignFormData>
  ): Promise<BackofficeEmailCampaignItem>
  cancelCampaign(id: string): Promise<BackofficeEmailCampaignItem>
  sendNow(id: string): Promise<BackofficeEmailCampaignItem>
  listDispatches(id: string): Promise<BackofficeEmailCampaignDispatchItem[]>
  listContactLists(): Promise<BackofficeEmailContactListOption[]>
  listTemplates(): Promise<BackofficeEmailTemplateOption[]>
}
