import { Output } from "@/lib/output"

export interface UpsertBackofficeEmailCampaignData {
  name?: string
  contactListId?: string
  scheduledAt?: string
  resendTemplateId?: string | null
  resendTemplateName?: string | null
  fromName?: string | null
  fromEmail?: string | null
  replyTo?: string | null
}

export interface BackofficeLeadForCampaignSubscription {
  id: string
  email: string | null
  name: string
}

export interface ApplyBackofficeResendWebhookEventInput {
  resendEmailId: string
  eventType: string
  occurredAt: Date
  metadata?: Record<string, unknown> | null
}

export interface IBackofficeEmailCampaignUseCase {
  list(): Promise<Output>
  getById(id: string): Promise<Output>
  create(data: UpsertBackofficeEmailCampaignData, backofficeUserId: string): Promise<Output>
  update(id: string, data: UpsertBackofficeEmailCampaignData): Promise<Output>
  cancel(id: string): Promise<Output>
  sendNow(id: string, backofficeUserId: string): Promise<Output>
  listDispatches(id: string): Promise<Output>
  getUpcomingLiveCampaignInfo(): Promise<Output>
  ensureUpcomingLiveCampaignExists(): Promise<Output>
  dispatchDueCampaigns(now?: Date): Promise<Output>
  recoverStuckDispatches(): Promise<Output>
  subscribeFromLead(lead: BackofficeLeadForCampaignSubscription): Promise<Output>
  applyResendWebhookEvent(
    input: ApplyBackofficeResendWebhookEventInput
  ): Promise<Output & { result: { handled: boolean } }>
}
