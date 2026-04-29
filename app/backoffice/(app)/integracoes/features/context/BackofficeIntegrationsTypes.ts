export type BackofficeWebhookTokenExpiryMode =
  | "hours_24"
  | "months_6"
  | "indeterminate"

export type BackofficeWebhookTokenStatus = "active" | "replaced" | "expired" | "missing"

export interface BackofficeMetaIntegrationConfig {
  provider: "meta"
  configured: boolean
  webhookUrl: string
  webhookUrlTemplate: string
  tokenPreview: string | null
  tokenStatus: BackofficeWebhookTokenStatus
  expiryMode: BackofficeWebhookTokenExpiryMode
  expiresAt: string | null
  isExpired: boolean
  lastUsedAt: string | null
  generatedByEmailSnapshot: string | null
  generatedAt: string | null
}

export type BackofficeWebhookEventStatusKey = "received" | "processed" | "failed"

export interface BackofficeMetaWebhookEventItem {
  id: string
  source: "meta"
  eventType: string | null
  status: BackofficeWebhookEventStatusKey
  errorMessage: string | null
  receivedAt: string
  processedAt: string | null
}

export interface BackofficeMetaWebhookTokenHistoryItem {
  id: string
  source: "meta"
  tokenPreview: string
  status: "active" | "replaced" | "expired"
  expiryMode: BackofficeWebhookTokenExpiryMode
  expiresAt: string | null
  lastUsedAt: string | null
  generatedByEmailSnapshot: string
  generatedAt: string
}

export type BackofficeWebhookRequestLogResultType = "success" | "error"

export interface BackofficeMetaWebhookRequestLogItem {
  id: string
  source: "meta"
  method: string
  endpoint: string
  statusCode: number
  resultType: BackofficeWebhookRequestLogResultType
  requestPayload: unknown
  responsePayload: unknown
  errorMessage: string | null
  createdAt: string
}
