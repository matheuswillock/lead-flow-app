import type { BackofficeEmailOrphanEvent, Prisma } from "@prisma/client"

export interface QueueBackofficeEmailOrphanEventInput {
  resendEmailId: string
  resendEventType: string
  occurredAt: Date
  tagsHint?: Prisma.InputJsonValue | null
}

export interface IBackofficeEmailOrphanEventRepository {
  queue(data: QueueBackofficeEmailOrphanEventInput): Promise<void>
  findPendingBatch(limit: number): Promise<BackofficeEmailOrphanEvent[]>
  markProcessed(id: string): Promise<void>
  markFailed(id: string, error: string): Promise<void>
}
