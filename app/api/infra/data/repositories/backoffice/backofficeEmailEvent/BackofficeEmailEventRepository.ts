import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  AppendBackofficeEmailEventInput,
  IBackofficeEmailEventRepository,
} from "./IBackofficeEmailEventRepository"

export class BackofficeEmailEventRepository implements IBackofficeEmailEventRepository {
  /** Returns false when the event was already recorded (idempotent replay-safe). */
  async append(data: AppendBackofficeEmailEventInput): Promise<boolean> {
    try {
      await prisma.backofficeEmailEvent.create({
        data: {
          logId: data.logId,
          type: data.type,
          occurredAt: data.occurredAt,
          metadata: data.metadata ?? undefined,
        },
      })
      return true
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false
      }
      throw error
    }
  }
}

export const backofficeEmailEventRepository = new BackofficeEmailEventRepository()
