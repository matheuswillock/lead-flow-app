import type {
  BackofficeWhatsAppInstanceDetail,
  BackofficeWhatsAppInstanceListItem,
  BackofficeWhatsAppInstancesFilters,
  BackofficeWhatsAppInstancesPagination,
  BackofficeWhatsAppTeamWithoutInstance,
  BackofficeWhatsAppWebhookResyncResult,
  ProvisionWhatsAppInstanceFormData,
  UpdateWhatsAppInstanceFormData,
} from "../context/BackofficeWhatsAppInstancesTypes"

export interface ApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

export interface IBackofficeWhatsAppInstancesService {
  list(
    filters: BackofficeWhatsAppInstancesFilters,
    pagination: { page: number; pageSize: number }
  ): Promise<{ items: BackofficeWhatsAppInstanceListItem[]; pagination: BackofficeWhatsAppInstancesPagination }>
  getDetail(configId: string): Promise<BackofficeWhatsAppInstanceDetail>
  update(
    configId: string,
    data: UpdateWhatsAppInstanceFormData
  ): Promise<ApiOutput<BackofficeWhatsAppInstanceDetail>>
  provision(data: ProvisionWhatsAppInstanceFormData): Promise<ApiOutput<BackofficeWhatsAppInstanceDetail>>
  reconnect(configId: string): Promise<ApiOutput<BackofficeWhatsAppInstanceDetail>>
  disconnect(configId: string): Promise<ApiOutput<BackofficeWhatsAppInstanceDetail>>
  syncHistory(configId: string): Promise<ApiOutput<BackofficeWhatsAppInstanceDetail>>
  listTeamsWithoutInstance(
    q?: string
  ): Promise<BackofficeWhatsAppTeamWithoutInstance[]>
  previewResyncWebhooks(): Promise<ApiOutput<BackofficeWhatsAppWebhookResyncResult>>
  confirmResyncWebhooks(): Promise<ApiOutput<BackofficeWhatsAppWebhookResyncResult>>
}
