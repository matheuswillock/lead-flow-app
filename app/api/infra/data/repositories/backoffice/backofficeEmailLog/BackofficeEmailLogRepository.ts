import { BackofficeEmailLogStatus, type BackofficeEmailLog } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateBackofficeEmailLogInput,
  IBackofficeEmailLogRepository,
} from "./IBackofficeEmailLogRepository"

const STATUS_PRIORITY: BackofficeEmailLogStatus[] = [
  "complained",
  "bounced",
  "failed",
  "clicked",
  "opened",
  "delivered",
  "sent",
  "queued",
]

function getStatusPriority(status: BackofficeEmailLogStatus): number {
  const index = STATUS_PRIORITY.indexOf(status)
  return index === -1 ? STATUS_PRIORITY.length : index
}

export class BackofficeEmailLogRepository implements IBackofficeEmailLogRepository {
  async createQueuedBatch(entries: CreateBackofficeEmailLogInput[]): Promise<BackofficeEmailLog[]> {
    return prisma.$transaction(
      entries.map((entry) =>
        prisma.backofficeEmailLog.create({
          data: {
            campaignId: entry.campaignId,
            dispatchId: entry.dispatchId,
            contactId: entry.contactId,
            recipientEmail: entry.recipientEmail,
            status: BackofficeEmailLogStatus.queued,
          },
        })
      )
    )
  }

  async findByDispatchId(dispatchId: string): Promise<BackofficeEmailLog[]> {
    return prisma.backofficeEmailLog.findMany({ where: { dispatchId } })
  }

  async findByResendEmailId(resendEmailId: string): Promise<BackofficeEmailLog | null> {
    return prisma.backofficeEmailLog.findUnique({ where: { resendEmailId } })
  }

  async markSent(id: string, resendEmailId: string): Promise<void> {
    await prisma.backofficeEmailLog.update({
      where: { id },
      data: { resendEmailId, status: BackofficeEmailLogStatus.sent, sentAt: new Date() },
    })
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await prisma.backofficeEmailLog.update({
      where: { id },
      data: { status: BackofficeEmailLogStatus.failed, errorMessage },
    })
  }

  async applyStatusIfHigherPriority(
    id: string,
    status: BackofficeEmailLogStatus,
    timestampField?: "sentAt" | "deliveredAt" | "openedAt" | "clickedAt" | "bouncedAt" | "complainedAt",
    occurredAt?: Date
  ): Promise<void> {
    const log = await prisma.backofficeEmailLog.findUnique({ where: { id } })
    if (!log) return

    const shouldUpdateStatus = getStatusPriority(status) < getStatusPriority(log.status)

    await prisma.backofficeEmailLog.update({
      where: { id },
      data: {
        ...(shouldUpdateStatus ? { status } : {}),
        ...(timestampField && occurredAt ? { [timestampField]: occurredAt } : {}),
      },
    })
  }
}

export const backofficeEmailLogRepository = new BackofficeEmailLogRepository()
