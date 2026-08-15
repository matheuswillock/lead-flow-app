import { prisma } from "@/app/api/infra/data/prisma"
import {
  computePublicFormQueueEventFailureNextAttemptAt,
  PUBLIC_FORM_QUEUE_EVENT_FAILURE_MAX_ATTEMPTS,
  shouldRetryPublicFormQueueEventFailure,
} from "@/lib/public-forms/public-form-queue-event-failure-backoff"
import type {
  IPublicFormQueueEventFailureRepository,
  PublicFormQueueEventFailureClaimRow,
  UpsertPublicFormQueueEventFailureInput,
} from "./IPublicFormQueueEventFailureRepository"

function formatProcessingError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 2000)
  }
  return String(error).slice(0, 2000)
}

/** Rows stuck in `processing` longer than this are treated as abandoned leases. */
const STALE_PROCESSING_MS = 10 * 60 * 1000

export class PublicFormQueueEventFailureRepository
  implements IPublicFormQueueEventFailureRepository
{
  async upsertFromProcessingFailure(
    input: UpsertPublicFormQueueEventFailureInput,
  ): Promise<void> {
    const existing = await prisma.publicFormQueueEventFailure.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { status: true },
    })
    if (existing?.status === "resolved") {
      return
    }

    const now = new Date()
    await prisma.publicFormQueueEventFailure.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        status: "pending",
        attemptCount: 1,
        nextAttemptAt: now,
        lastError: input.lastError,
        failureReason: input.failureReason,
      },
      update: {
        kind: input.kind,
        payload: input.payload,
        lastError: input.lastError,
        failureReason: input.failureReason,
        status: "pending",
        nextAttemptAt: now,
      },
    })
  }

  private async recoverStaleProcessingClaims(now: Date): Promise<void> {
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS)
    const staleRows = await prisma.publicFormQueueEventFailure.findMany({
      where: {
        status: "processing",
        updatedAt: { lt: staleBefore },
      },
      select: { id: true, attemptCount: true },
    })

    for (const row of staleRows) {
      const nextAttemptCount = row.attemptCount + 1
      const exhausted = nextAttemptCount >= PUBLIC_FORM_QUEUE_EVENT_FAILURE_MAX_ATTEMPTS

      await prisma.publicFormQueueEventFailure.updateMany({
        where: { id: row.id, status: "processing" },
        data: {
          status: exhausted ? "failed" : "pending",
          attemptCount: nextAttemptCount,
          lastError: exhausted
            ? "Lease de processamento expirado; tentativas esgotadas"
            : "Lease de processamento expirado; reenfileirado",
          nextAttemptAt: now,
        },
      })
    }
  }

  async claimDue(limit: number): Promise<PublicFormQueueEventFailureClaimRow[]> {
    const now = new Date()
    await this.recoverStaleProcessingClaims(now)

    const due = await prisma.publicFormQueueEventFailure.findMany({
      where: {
        status: "pending",
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
      select: {
        id: true,
        kind: true,
        idempotencyKey: true,
        payload: true,
        attemptCount: true,
      },
    })

    const claimed: PublicFormQueueEventFailureClaimRow[] = []
    for (const row of due) {
      const updated = await prisma.publicFormQueueEventFailure.updateMany({
        where: { id: row.id, status: "pending" },
        data: { status: "processing" },
      })
      if (updated.count === 1) {
        claimed.push(row)
      }
    }
    return claimed
  }

  async markResolved(id: string): Promise<void> {
    await prisma.publicFormQueueEventFailure.updateMany({
      where: { id, status: "processing" },
      data: { status: "resolved", lastError: null },
    })
  }

  async markRetryOrFailed(
    id: string,
    attemptCountAfterFailure: number,
    lastError: string,
  ): Promise<"retried" | "failed"> {
    const trimmedError = lastError.slice(0, 2000)
    if (!shouldRetryPublicFormQueueEventFailure(attemptCountAfterFailure)) {
      await prisma.publicFormQueueEventFailure.updateMany({
        where: { id, status: "processing" },
        data: {
          status: "failed",
          attemptCount: attemptCountAfterFailure,
          lastError: trimmedError,
        },
      })
      return "failed"
    }

    const nextAttemptAt = computePublicFormQueueEventFailureNextAttemptAt(
      attemptCountAfterFailure,
    )
    await prisma.publicFormQueueEventFailure.updateMany({
      where: { id, status: "processing" },
      data: {
        status: "pending",
        attemptCount: attemptCountAfterFailure,
        lastError: trimmedError,
        nextAttemptAt: nextAttemptAt ?? new Date(),
      },
    })
    return "retried"
  }

  async requeueIfProcessing(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await prisma.publicFormQueueEventFailure.updateMany({
      where: {
        id: { in: ids },
        status: "processing",
      },
      data: {
        status: "pending",
        nextAttemptAt: new Date(),
      },
    })
  }
}

export const publicFormQueueEventFailureRepository = new PublicFormQueueEventFailureRepository()

export { formatProcessingError }
