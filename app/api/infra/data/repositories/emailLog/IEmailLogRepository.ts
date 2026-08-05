import type { EmailEventType, EmailLogCategory } from "@prisma/client"

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
}

export interface IEmailLogRepository {
  findByResendEmailId(resendEmailId: string): Promise<EmailLogWebhookRecord | null>
  findCampaignLogForAttribution(
    teamId: string,
    emailLogId: string
  ): Promise<CampaignEmailLogAttributionRecord | null>
  hasDuplicateEvent(logId: string, eventType: EmailEventType, occurredAt: Date): Promise<boolean>
  applyWebhookEvent(input: ApplyEmailLogWebhookInput): Promise<void>
  createQueuedLog(input: CreateTeamEmailLogInput): Promise<string>
  createManyQueuedLogs(inputs: CreateTeamEmailLogInput[]): Promise<void>
  markSent(logId: string, resendEmailId: string, sentAt: Date): Promise<void>
  markManySent(entries: MarkSentEntry[], sentAt: Date): Promise<void>
  markFailed(logId: string, eventId: string, errorMessage: string, occurredAt: Date): Promise<void>
}
