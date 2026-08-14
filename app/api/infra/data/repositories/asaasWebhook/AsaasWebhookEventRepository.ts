import type { AsaasWebhookEventStatus, Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS,
  computeAsaasWebhookEventNextAttemptAt,
  shouldRetryAsaasWebhookEvent,
} from "@/lib/webhooks/asaas-webhook-event-backoff"

export type AsaasWebhookEventClaimResult =
  | "process"
  | "already_processed"
  | "already_processing"

export type AsaasWebhookEventClaimRow = {
  id: string
  eventType: string | null
  payload: Prisma.JsonValue
  attemptCount: number
}

/** Rows stuck in `processing` longer than this are treated as abandoned leases. */
const STALE_PROCESSING_MS = 10 * 60 * 1000

export interface IAsaasWebhookEventRepository {
  claimForProcessing(input: {
    id: string
    eventType: string | null
    payload: Prisma.InputJsonValue
  }): Promise<AsaasWebhookEventClaimResult>
  markProcessed(id: string): Promise<void>
  markFailed(
    id: string,
    errorMessage: string,
    failureReason?: "queue_publish_failed"
  ): Promise<void>
  claimDue(limit: number): Promise<AsaasWebhookEventClaimRow[]>
  markRetryOrFailed(
    id: string,
    attemptCountAfterFailure: number,
    lastError: string
  ): Promise<"retried" | "failed">
  requeueIfProcessing(ids: string[]): Promise<void>
}

export class AsaasWebhookEventRepository implements IAsaasWebhookEventRepository {
  async claimForProcessing(input: {
    id: string
    eventType: string | null
    payload: Prisma.InputJsonValue
  }): Promise<AsaasWebhookEventClaimResult> {
    const existing = await prisma.asaasWebhookEvent.findUnique({
      where: { id: input.id },
      select: { status: true },
    })

    if (existing?.status === "processed") {
      return "already_processed"
    }

    if (existing?.status === "processing") {
      return "already_processing"
    }

    if (!existing) {
      await prisma.asaasWebhookEvent.create({
        data: {
          id: input.id,
          eventType: input.eventType,
          payload: input.payload,
          status: "processing",
        },
      })
      return "process"
    }

    const updated = await prisma.asaasWebhookEvent.updateMany({
      where: {
        id: input.id,
        status: { in: ["pending", "failed"] satisfies AsaasWebhookEventStatus[] },
      },
      data: {
        status: "processing",
        errorMessage: null,
        processedAt: null,
        payload: input.payload,
        eventType: input.eventType,
      },
    })

    if (updated.count === 0) {
      const current = await prisma.asaasWebhookEvent.findUnique({
        where: { id: input.id },
        select: { status: true },
      })
      if (current?.status === "processed") return "already_processed"
      return "already_processing"
    }

    return "process"
  }

  async markProcessed(id: string): Promise<void> {
    await prisma.asaasWebhookEvent.update({
      where: { id },
      data: {
        status: "processed",
        processedAt: new Date(),
        errorMessage: null,
        failureReason: null,
      },
    })
  }

  async markFailed(
    id: string,
    errorMessage: string,
    failureReason?: "queue_publish_failed"
  ): Promise<void> {
    await prisma.asaasWebhookEvent.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: errorMessage.slice(0, 2000),
        ...(failureReason ? { failureReason } : {}),
      },
    })
  }

  private async recoverStaleProcessingClaims(now: Date): Promise<void> {
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS)
    const staleRows = await prisma.asaasWebhookEvent.findMany({
      where: {
        status: "processing",
        updatedAt: { lt: staleBefore },
      },
      select: { id: true, attemptCount: true },
    })

    for (const row of staleRows) {
      const nextAttemptCount = row.attemptCount + 1
      const exhausted = nextAttemptCount >= ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS

      await prisma.asaasWebhookEvent.updateMany({
        where: { id: row.id, status: "processing" },
        data: {
          status: exhausted ? "failed" : "pending",
          attemptCount: nextAttemptCount,
          errorMessage: exhausted
            ? "Lease de processamento expirado; tentativas esgotadas"
            : "Lease de processamento expirado; reenfileirado",
          nextAttemptAt: now,
        },
      })
    }
  }

  async claimDue(limit: number): Promise<AsaasWebhookEventClaimRow[]> {
    const now = new Date()
    await this.recoverStaleProcessingClaims(now)

    const due = await prisma.asaasWebhookEvent.findMany({
      where: {
        status: { in: ["pending", "failed"] },
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: limit,
      select: {
        id: true,
        eventType: true,
        payload: true,
        attemptCount: true,
      },
    })

    const claimed: AsaasWebhookEventClaimRow[] = []
    for (const row of due) {
      const updated = await prisma.asaasWebhookEvent.updateMany({
        where: { id: row.id, status: { in: ["pending", "failed"] } },
        data: { status: "processing" },
      })
      if (updated.count === 1) {
        claimed.push(row)
      }
    }
    return claimed
  }

  async markRetryOrFailed(
    id: string,
    attemptCountAfterFailure: number,
    lastError: string
  ): Promise<"retried" | "failed"> {
    const trimmedError = lastError.slice(0, 2000)
    if (!shouldRetryAsaasWebhookEvent(attemptCountAfterFailure)) {
      await prisma.asaasWebhookEvent.updateMany({
        where: { id, status: "processing" },
        data: {
          status: "failed",
          attemptCount: attemptCountAfterFailure,
          errorMessage: trimmedError,
        },
      })
      return "failed"
    }

    const nextAttemptAt =
      computeAsaasWebhookEventNextAttemptAt(attemptCountAfterFailure) ?? new Date()
    await prisma.asaasWebhookEvent.updateMany({
      where: { id, status: "processing" },
      data: {
        status: "pending",
        attemptCount: attemptCountAfterFailure,
        errorMessage: trimmedError,
        nextAttemptAt,
      },
    })
    return "retried"
  }

  async requeueIfProcessing(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await prisma.asaasWebhookEvent.updateMany({
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

export const asaasWebhookEventRepository = new AsaasWebhookEventRepository()
