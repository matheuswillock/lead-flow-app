import type { AsaasWebhookEventStatus, Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export type AsaasWebhookEventClaimResult =
  | "process"
  | "already_processed"
  | "already_processing"

export interface IAsaasWebhookEventRepository {
  claimForProcessing(input: {
    id: string
    eventType: string | null
    payload: Prisma.InputJsonValue
  }): Promise<AsaasWebhookEventClaimResult>
  markProcessed(id: string): Promise<void>
  markFailed(id: string, errorMessage: string): Promise<void>
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
      },
    })
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await prisma.asaasWebhookEvent.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: errorMessage.slice(0, 2000),
      },
    })
  }
}

export const asaasWebhookEventRepository = new AsaasWebhookEventRepository()
