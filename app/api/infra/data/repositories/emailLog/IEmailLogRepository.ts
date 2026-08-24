import type { EmailEventType, EmailLogCategory } from "@prisma/client"

/** Mesma forma de `DispatchLogCounters` em lib/email/campaign-dispatch-progress. */
export type DispatchLogCountersRecord = {
  acceptedCount: number
  failedCount: number
  queuedCount: number
  suppressedCount: number
}

export type EmailLogWebhookRecord = {
  id: string
  teamId: string
  status: string
  recipientEmail: string
  recipientName: string | null
  campaignId: string | null
  dispatchId: string | null
  deliveredAt: Date | null
  openedAt: Date | null
  clickedAt: Date | null
  bouncedAt: Date | null
  complainedAt: Date | null
}

export type ApplyEmailLogWebhookInput = {
  log: EmailLogWebhookRecord
  eventType: EmailEventType
  occurredAt: Date
  metadata: Record<string, unknown>
  eventId: string
}

export type CreateTeamEmailLogInput = {
  id: string
  teamId: string
  campaignId?: string | null
  dispatchId?: string | null
  recipientEmail: string
  recipientName?: string | null
  subject: string
  category: EmailLogCategory
  sourceType?: string | null
  sourceId?: string | null
}

export type MarkSentEntry = {
  logId: string
  resendEmailId: string
}

export type CampaignEmailLogAttributionRecord = {
  id: string
  campaignId: string | null
  dispatchId: string | null
  recipientEmail: string
  recipientName: string | null
  campaignName: string | null
}

export interface IEmailLogRepository {
  findByResendEmailId(resendEmailId: string): Promise<EmailLogWebhookRecord | null>
  findCampaignLogForAttribution(
    teamId: string,
    emailLogId: string
  ): Promise<CampaignEmailLogAttributionRecord | null>
  findCampaignWebhookRecordById(
    teamId: string,
    emailLogId: string
  ): Promise<EmailLogWebhookRecord | null>
  hasDuplicateEvent(logId: string, eventType: EmailEventType, occurredAt: Date): Promise<boolean>
  applyWebhookEvent(input: ApplyEmailLogWebhookInput): Promise<void>
  createQueuedLog(input: CreateTeamEmailLogInput): Promise<string>
  createManyQueuedLogs(inputs: CreateTeamEmailLogInput[]): Promise<void>
  markSent(logId: string, resendEmailId: string, sentAt: Date): Promise<void>
  markManySent(entries: MarkSentEntry[], sentAt: Date): Promise<void>
  markFailed(logId: string, eventId: string, errorMessage: string, occurredAt: Date): Promise<void>
  /** Recusa da pré-validação interna (terminal), distinta de falha do provedor (retentável). */
  markSuppressed(logId: string, eventId: string, reason: string, occurredAt: Date): Promise<void>
  /**
   * Contadores de log por dispatch, agregados no banco (não carrega N logs na
   * aplicação). `accepted` é evidência de aceite pelo provedor — `sentAt` ou
   * `resendEmailId` —, e os demais tiers só contam quando não houve aceite.
   */
  aggregateCountersByDispatchId(
    teamId: string,
    dispatchIds: string[]
  ): Promise<Map<string, DispatchLogCountersRecord>>
}
