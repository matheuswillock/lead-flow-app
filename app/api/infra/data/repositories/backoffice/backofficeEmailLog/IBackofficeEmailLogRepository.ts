import type { BackofficeEmailLog, BackofficeEmailLogStatus } from "@prisma/client"

export interface CreateBackofficeEmailLogInput {
  campaignId: string
  dispatchId: string
  contactId: string
  recipientEmail: string
}

export interface IBackofficeEmailLogRepository {
  createQueuedBatch(entries: CreateBackofficeEmailLogInput[]): Promise<BackofficeEmailLog[]>
  findByDispatchId(dispatchId: string): Promise<BackofficeEmailLog[]>
  findByResendEmailId(resendEmailId: string): Promise<BackofficeEmailLog | null>
  markSent(id: string, resendEmailId: string): Promise<void>
  markFailed(id: string, errorMessage: string): Promise<void>
  applyStatusIfHigherPriority(
    id: string,
    status: BackofficeEmailLogStatus,
    timestampField?: "sentAt" | "deliveredAt" | "openedAt" | "clickedAt" | "bouncedAt" | "complainedAt",
    occurredAt?: Date
  ): Promise<void>
}
