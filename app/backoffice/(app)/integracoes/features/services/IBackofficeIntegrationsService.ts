import type {
  BackofficeMetaIntegrationConfig,
  BackofficeMetaWebhookRequestLogItem,
  BackofficeMetaWebhookTokenHistoryItem,
  BackofficeWebhookTokenExpiryMode,
} from "../context/BackofficeIntegrationsTypes"

export interface IBackofficeIntegrationsService {
  getMetaConfig(): Promise<BackofficeMetaIntegrationConfig>
  generateMetaToken(expiryMode: BackofficeWebhookTokenExpiryMode): Promise<BackofficeMetaIntegrationConfig>
  listMetaTokenHistory(limit?: number): Promise<BackofficeMetaWebhookTokenHistoryItem[]>
  listMetaLogs(limit?: number): Promise<BackofficeMetaWebhookRequestLogItem[]>
}
