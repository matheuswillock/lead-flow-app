import type { Prisma } from "@prisma/client"

export type QueueProcessingFailureClaimRow = {
  id: string
  topic: string
  idempotencyKey: string
  payload: Prisma.JsonValue
  attemptCount: number
}

export type UpsertQueueProcessingFailureInput = {
  topic: string
  idempotencyKey: string
  payload: Prisma.InputJsonValue
  lastError: string
}

export interface IQueueProcessingFailureRepository {
  upsertFromProcessingFailure(input: UpsertQueueProcessingFailureInput): Promise<void>
  claimDue(limit: number): Promise<QueueProcessingFailureClaimRow[]>
  markResolved(id: string): Promise<void>
  markRetryOrFailed(
    id: string,
    attemptCountAfterFailure: number,
    lastError: string,
  ): Promise<"retried" | "failed">
  requeueIfProcessing(ids: string[]): Promise<void>
}
