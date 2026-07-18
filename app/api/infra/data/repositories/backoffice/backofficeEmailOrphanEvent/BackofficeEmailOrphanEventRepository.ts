import { BackofficeEmailOrphanEventStatus, Prisma, type BackofficeEmailOrphanEvent } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeEmailOrphanEventRepository,
  QueueBackofficeEmailOrphanEventInput,
} from "./IBackofficeEmailOrphanEventRepository"

export class BackofficeEmailOrphanEventRepository implements IBackofficeEmailOrphanEventRepository {
  async queue(data: QueueBackofficeEmailOrphanEventInput): Promise<void> {
    try {
      await prisma.backofficeEmailOrphanEvent.create({
        data: {
          resendEmailId: data.resendEmailId,
          resendEventType: data.resendEventType,
          occurredAt: data.occurredAt,
          tagsHint: data.tagsHint ?? undefined,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return
      }
      throw error
    }
  }

  async findPendingBatch(limit: number): Promise<BackofficeEmailOrphanEvent[]> {
    return prisma.backofficeEmailOrphanEvent.findMany({
      where: { status: BackofficeEmailOrphanEventStatus.pending },
      orderBy: { createdAt: "asc" },
      take: limit,
    })
  }

  async markProcessed(id: string): Promise<void> {
    await prisma.backofficeEmailOrphanEvent.update({
      where: { id },
      data: { status: BackofficeEmailOrphanEventStatus.processed },
    })
  }

  async markFailed(id: string, error: string): Promise<void> {
    await prisma.backofficeEmailOrphanEvent.update({
      where: { id },
      data: {
        status: BackofficeEmailOrphanEventStatus.failed,
        attempts: { increment: 1 },
        lastError: error,
      },
    })
  }
}

export const backofficeEmailOrphanEventRepository = new BackofficeEmailOrphanEventRepository()
