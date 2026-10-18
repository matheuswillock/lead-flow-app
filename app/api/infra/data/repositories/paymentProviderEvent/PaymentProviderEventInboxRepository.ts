import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { PaymentProviderEventInboxClaim } from "@/lib/payment-provider/event-inbox"
import type { IPaymentProviderEventInboxRepository, PaymentProviderEventClaimInput } from "./IPaymentProviderEventInboxRepository"

const MAX_ERROR_LENGTH = 2_000

export class PaymentProviderEventInboxRepository implements IPaymentProviderEventInboxRepository {
  async claim(input: PaymentProviderEventClaimInput): Promise<PaymentProviderEventInboxClaim> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const existing = await transaction.paymentProviderEventDedupe.findUnique({
          where: { dedupeKey: input.dedupeKey },
          select: { payloadHash: true },
        })

        if (existing) {
          if (existing.payloadHash !== input.payloadHash) return { kind: "conflict" as const }
          const claimToken = await reclaimExisting(transaction, input)
          if (claimToken) return { kind: "claimed" as const, claimToken }
          return { kind: "duplicate" as const }
        }

        await transaction.paymentProviderEventDedupe.create({
          data: {
            dedupeKey: input.dedupeKey,
            providerKey: input.provider,
            environment: input.environment,
            externalAccountContext: input.externalAccountContext,
            eventId: input.eventId,
            payloadHash: input.payloadHash,
            tombstoneUntil: input.tombstoneUntil,
          },
        })

        const claimToken = randomUUID()
        const inbox = await transaction.paymentProviderEventInbox.create({
          data: {
            dedupeKey: input.dedupeKey,
            providerKey: input.provider,
            environment: input.environment,
            externalAccountContext: input.externalAccountContext,
            eventId: input.eventId,
            payloadHash: input.payloadHash,
            payload: toJsonValue(input.payload),
            normalizedEvent: input.normalizedEvent,
            claimToken,
            tombstoneUntil: input.tombstoneUntil,
            status: "processing",
          },
        })

        await transaction.paymentProviderEventOutbox.create({
          data: {
            inboxId: inbox.id,
            eventType: input.normalizedEvent ?? "PROVIDER_EVENT_RECEIVED",
            payload: toJsonValue(input.payload),
            status: "pending",
          },
        })

        return { kind: "claimed" as const, claimToken }
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error

      const existing = await prisma.paymentProviderEventDedupe.findUnique({
        where: { dedupeKey: input.dedupeKey },
        select: { payloadHash: true },
      })
      if (!existing) throw error
      if (existing.payloadHash !== input.payloadHash) return { kind: "conflict" }
      return prisma.$transaction(async (transaction) => {
        const claimToken = await reclaimExisting(transaction, input)
        return claimToken
          ? { kind: "claimed" as const, claimToken }
          : { kind: "duplicate" as const }
      })
    }
  }

  async assertClaimActive(input: {
    dedupeKey: string
    claimToken: string
    now: Date
    staleBefore: Date
  }): Promise<boolean> {
    const result = await prisma.paymentProviderEventInbox.updateMany({
      where: {
        dedupeKey: input.dedupeKey,
        claimToken: input.claimToken,
        status: "processing",
        updatedAt: { gte: input.staleBefore },
      },
      data: { updatedAt: input.now },
    })
    return result.count === 1
  }

  async markProcessed(input: { dedupeKey: string; claimToken: string }): Promise<void> {
    await prisma.paymentProviderEventInbox.updateMany({
      where: { dedupeKey: input.dedupeKey, claimToken: input.claimToken, status: "processing" },
      data: { status: "processed", processedAt: new Date(), errorMessage: null },
    })
  }

  async markFailed(input: { dedupeKey: string; claimToken: string; message: string }): Promise<void> {
    await prisma.paymentProviderEventInbox.updateMany({
      where: { dedupeKey: input.dedupeKey, claimToken: input.claimToken, status: "processing" },
      data: {
        status: "failed",
        attemptCount: { increment: 1 },
        errorMessage: input.message.slice(0, MAX_ERROR_LENGTH),
      },
    })
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

async function reclaimExisting(
  transaction: Prisma.TransactionClient,
  input: PaymentProviderEventClaimInput,
): Promise<string | null> {
  const claimToken = randomUUID()
  const result = await transaction.paymentProviderEventInbox.updateMany({
    where: {
      dedupeKey: input.dedupeKey,
      payloadHash: input.payloadHash,
      OR: [
        { status: "failed" },
        { status: "processing", updatedAt: { lt: input.staleBefore } },
      ],
    },
    data: {
      status: "processing",
      errorMessage: null,
      claimToken,
      updatedAt: input.now,
    },
  })
  return result.count === 1 ? claimToken : null
}

function toJsonValue(payload: string): Prisma.InputJsonValue {
  try {
    return JSON.parse(payload) as Prisma.InputJsonValue
  } catch {
    return payload
  }
}

export const paymentProviderEventInboxRepository = new PaymentProviderEventInboxRepository()
