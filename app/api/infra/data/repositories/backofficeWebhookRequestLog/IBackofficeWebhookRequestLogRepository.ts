import type {
  BackofficeWebhookRequestLog,
  BackofficeWebhookSource,
} from "@prisma/client"

export type BackofficeWebhookRequestLogResultType = "success" | "error"

export interface CreateBackofficeWebhookRequestLogInput {
  source: BackofficeWebhookSource
  method: string
  endpoint: string
  statusCode: number
  resultType: BackofficeWebhookRequestLogResultType
  requestPayload?: unknown
  responsePayload?: unknown
  errorMessage?: string | null
}

export interface ListBackofficeWebhookRequestLogsParams {
  source?: BackofficeWebhookSource
  limit?: number
}

export interface IBackofficeWebhookRequestLogRepository {
  create(data: CreateBackofficeWebhookRequestLogInput): Promise<void>
  findMany(
    params?: ListBackofficeWebhookRequestLogsParams
  ): Promise<BackofficeWebhookRequestLog[]>
}
