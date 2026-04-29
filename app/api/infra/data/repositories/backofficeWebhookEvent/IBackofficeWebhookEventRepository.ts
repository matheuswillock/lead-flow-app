import type {
  BackofficeWebhookEvent,
  BackofficeWebhookEventStatus,
  BackofficeWebhookSource,
  Prisma,
} from "@prisma/client"

export interface CreateBackofficeWebhookEventInput {
  source: BackofficeWebhookSource
  eventType?: string | null
  payload: Prisma.InputJsonValue
  signature?: string | null
  status?: BackofficeWebhookEventStatus
  errorMessage?: string | null
}

export interface ListBackofficeWebhookEventsParams {
  source?: BackofficeWebhookSource
  status?: BackofficeWebhookEventStatus
  limit?: number
}

export interface IBackofficeWebhookEventRepository {
  create(data: CreateBackofficeWebhookEventInput): Promise<BackofficeWebhookEvent>
  findMany(params?: ListBackofficeWebhookEventsParams): Promise<BackofficeWebhookEvent[]>
  markProcessed(id: string): Promise<BackofficeWebhookEvent>
  markFailed(id: string, errorMessage: string): Promise<BackofficeWebhookEvent>
}
