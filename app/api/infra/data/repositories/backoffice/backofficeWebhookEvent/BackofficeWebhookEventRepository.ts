import type {
  BackofficeWebhookEvent,
  BackofficeWebhookEventStatus,
} from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBackofficeWebhookEventInput,
  IBackofficeWebhookEventRepository,
  ListBackofficeWebhookEventsParams,
} from "./IBackofficeWebhookEventRepository"

const DEFAULT_LIMIT = 50

export class BackofficeWebhookEventRepository
  implements IBackofficeWebhookEventRepository
{
  async create(data: CreateBackofficeWebhookEventInput): Promise<BackofficeWebhookEvent> {
    return prisma.backofficeWebhookEvent.create({
      data: {
        source: data.source,
        eventType: data.eventType ?? null,
        payload: data.payload,
        signature: data.signature ?? null,
        status: data.status,
        errorMessage: data.errorMessage ?? null,
      },
    })
  }

  async findMany(
    params?: ListBackofficeWebhookEventsParams
  ): Promise<BackofficeWebhookEvent[]> {
    return prisma.backofficeWebhookEvent.findMany({
      where: {
        source: params?.source,
        status: params?.status,
      },
      orderBy: { receivedAt: "desc" },
      take: params?.limit ?? DEFAULT_LIMIT,
    })
  }

  async markProcessed(id: string): Promise<BackofficeWebhookEvent> {
    return prisma.backofficeWebhookEvent.update({
      where: { id },
      data: {
        status: "processed" satisfies BackofficeWebhookEventStatus,
        processedAt: new Date(),
        errorMessage: null,
      },
    })
  }

  async markFailed(id: string, errorMessage: string): Promise<BackofficeWebhookEvent> {
    return prisma.backofficeWebhookEvent.update({
      where: { id },
      data: {
        status: "failed" satisfies BackofficeWebhookEventStatus,
        errorMessage,
        processedAt: new Date(),
      },
    })
  }
}
