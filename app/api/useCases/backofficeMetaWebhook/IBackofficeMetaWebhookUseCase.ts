import type { Output } from "@/lib/output"
import type { BackofficeWebhookTokenExpiryModeValue } from "@/lib/webhooks/backofficeWebhookSecurity"

export interface BackofficeMetaWebhookPayload {
  rawBody: string
  providedToken: string | null
  method: string
  endpoint: string
}

export interface GenerateBackofficeMetaWebhookTokenInput {
  expiryMode: BackofficeWebhookTokenExpiryModeValue
  generatedByBackofficeUserId: string
  generatedByEmailSnapshot: string
}

export interface IBackofficeMetaWebhookUseCase {
  ingest(payload: BackofficeMetaWebhookPayload): Promise<Output>
  listRecentEvents(limit?: number): Promise<Output>
  listTokenHistory(limit?: number): Promise<Output>
  listRequestLogs(limit?: number): Promise<Output>
  getIntegrationConfig(): Promise<Output>
  generateToken(input: GenerateBackofficeMetaWebhookTokenInput): Promise<Output>
}
