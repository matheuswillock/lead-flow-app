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
          const inbox = await transaction.paymentProviderEventInbox.findUnique({
            where: { dedupeKey: input.dedupeKey },
            select: { status: true },
          })
          if (inbox?.status === "failed") {
            await transaction.paymentProviderEventInbox.update({
              where: { dedupeKey: input.dedupeKey },
              data: { status: "processing", errorMessage: null, attemptCount: { increment: 1 } },
            })
            return { kind: "claimed" as const }
          }
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

        return { kind: "claimed" as const }
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error

      const existing = await prisma.paymentProviderEventDedupe.findUnique({
        where: { dedupeKey: input.dedupeKey },
        select: { payloadHash: true },
      })
      if (!existing) throw error
      return existing.payloadHash === input.payloadHash
        ? { kind: "duplicate" }
        : { kind: "conflict" }
    }
  }

  async markProcessed(dedupeKey: string): Promise<void> {
    await prisma.paymentProviderEventInbox.updateMany({
      where: { dedupeKey, status: "processing" },
      data: { status: "processed", processedAt: new Date(), errorMessage: null },
    })
  }

  async markFailed(dedupeKey: string, message: string): Promise<void> {
    await prisma.paymentProviderEventInbox.updateMany({
      where: { dedupeKey, status: "processing" },
      data: {
        status: "failed",
        attemptCount: { increment: 1 },
        errorMessage: message.slice(0, MAX_ERROR_LENGTH),
      },
    })
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function toJsonValue(payload: string): Prisma.InputJsonValue {
  try {
    return JSON.parse(payload) as Prisma.InputJsonValue
  } catch {
    return payload
  }
}

export const paymentProviderEventInboxRepository = new PaymentProviderEventInboxRepository()
