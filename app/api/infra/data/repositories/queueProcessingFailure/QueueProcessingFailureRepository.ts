import { prisma } from "@/app/api/infra/data/prisma"
import {
  computeQueueProcessingFailureNextAttemptAt,
  QUEUE_PROCESSING_FAILURE_MAX_ATTEMPTS,
  shouldRetryQueueProcessingFailure,
} from "@/lib/queues/queue-processing-failure-backoff"
import type {
  IQueueProcessingFailureRepository,
  QueueProcessingFailureClaimRow,
  UpsertQueueProcessingFailureInput,
} from "./IQueueProcessingFailureRepository"

/** Rows stuck in `processing` longer than this are treated as abandoned leases. */
const STALE_PROCESSING_MS = 10 * 60 * 1000

export class QueueProcessingFailureRepository implements IQueueProcessingFailureRepository {
  async upsertFromProcessingFailure(input: UpsertQueueProcessingFailureInput): Promise<void> {
    const existing = await prisma.queueProcessingFailure.findUnique({
      where: {
        topic_idempotencyKey: {
          topic: input.topic,
          idempotencyKey: input.idempotencyKey,
        },
      },
      select: { status: true },
    })

    const now = new Date()
    const shouldStartNewRetryGeneration =
      existing?.status === "resolved" || existing?.status === "failed"

    await prisma.queueProcessingFailure.upsert({
      where: {
        topic_idempotencyKey: {
          topic: input.topic,
          idempotencyKey: input.idempotencyKey,
        },
      },
      create: {
        topic: input.topic,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload,
        status: "pending",
        attemptCount: 1,
        nextAttemptAt: now,
        lastError: input.lastError,
      },
      update: {
        payload: input.payload,
        lastError: input.lastError,
        status: "pending",
        nextAttemptAt: now,
        ...(shouldStartNewRetryGeneration ? { attemptCount: 1 } : {}),
      },
    })
  }

  private async recoverStaleProcessingClaims(now: Date): Promise<void> {
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS)
    const staleRows = await prisma.queueProcessingFailure.findMany({
      where: {
        status: "processing",
        updatedAt: { lt: staleBefore },
      },
      select: { id: true, attemptCount: true },
    })

    for (const row of staleRows) {
      const nextAttemptCount = row.attemptCount + 1
      const exhausted = nextAttemptCount >= QUEUE_PROCESSING_FAILURE_MAX_ATTEMPTS

      await prisma.queueProcessingFailure.updateMany({
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

  async claimDue(limit: number): Promise<QueueProcessingFailureClaimRow[]> {
    const now = new Date()
    await this.recoverStaleProcessingClaims(now)

    const due = await prisma.queueProcessingFailure.findMany({
      where: {
        status: "pending",
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
      select: {
        id: true,
        topic: true,
        idempotencyKey: true,
        payload: true,
        attemptCount: true,
      },
    })

    const claimed: QueueProcessingFailureClaimRow[] = []
    for (const row of due) {
      const updated = await prisma.queueProcessingFailure.updateMany({
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
    await prisma.queueProcessingFailure.updateMany({
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
    if (!shouldRetryQueueProcessingFailure(attemptCountAfterFailure)) {
      await prisma.queueProcessingFailure.updateMany({
        where: { id, status: "processing" },
        data: {
          status: "failed",
          attemptCount: attemptCountAfterFailure,
          lastError: trimmedError,
        },
      })
      return "failed"
    }

    const nextAttemptAt = computeQueueProcessingFailureNextAttemptAt(attemptCountAfterFailure)
    await prisma.queueProcessingFailure.updateMany({
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
    await prisma.queueProcessingFailure.updateMany({
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

export const queueProcessingFailureRepository = new QueueProcessingFailureRepository()
