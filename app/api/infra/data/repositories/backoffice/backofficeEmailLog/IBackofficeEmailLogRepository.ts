import type { BackofficeEmailLog, BackofficeEmailLogStatus } from "@prisma/client"

export interface CreateBackofficeEmailLogInput {
  campaignId: string
  dispatchId: string
  contactId: string
  recipientEmail: string
}

export type QueuedBackofficeEmailLogRow = {
  id: string
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
  /** Lote limitado de destinatários `queued` do dispatch (consumer da fila, PR queue-first). */
  findQueuedByDispatchId(dispatchId: string, take: number): Promise<QueuedBackofficeEmailLogRow[]>
  countQueuedByDispatchId(dispatchId: string): Promise<number>
  /** Conta logs que saíram de `queued` sem terminar em `failed` (enviados com sucesso, mesmo que bounced/complained depois). */
  countSentByDispatchId(dispatchId: string): Promise<number>
}
