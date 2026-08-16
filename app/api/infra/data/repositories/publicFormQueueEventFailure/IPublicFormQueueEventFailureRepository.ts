import type { Prisma, PublicFormQueueEventKind } from "@prisma/client"

export type PublicFormQueueEventFailureClaimRow = {
  id: string
  kind: PublicFormQueueEventKind
  idempotencyKey: string
  payload: Prisma.JsonValue
  attemptCount: number
}

export type UpsertPublicFormQueueEventFailureInput = {
  kind: PublicFormQueueEventKind
  idempotencyKey: string
  payload: Prisma.InputJsonValue
  lastError: string
  failureReason: "queue_publish_failed" | "delivery_count_exceeded"
}

export interface IPublicFormQueueEventFailureRepository {
  upsertFromProcessingFailure(input: UpsertPublicFormQueueEventFailureInput): Promise<void>
  claimDue(limit: number): Promise<PublicFormQueueEventFailureClaimRow[]>
  markResolved(id: string): Promise<void>
  markRetryOrFailed(
    id: string,
    attemptCountAfterFailure: number,
    lastError: string,
  ): Promise<"retried" | "failed">
  requeueIfProcessing(ids: string[]): Promise<void>
}
