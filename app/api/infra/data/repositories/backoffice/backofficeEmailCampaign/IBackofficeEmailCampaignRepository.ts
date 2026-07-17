import type { BackofficeEmailCampaign, BackofficeEmailCampaignStatus } from "@prisma/client"

export interface CreateBackofficeEmailCampaignInput {
  name: string
  contactListId: string
  scheduledAt: Date
  resendTemplateId?: string | null
  resendTemplateName?: string | null
  fromName?: string | null
  fromEmail?: string | null
  replyTo?: string | null
  createdByBackofficeUserId?: string | null
}

export interface UpdateBackofficeEmailCampaignInput {
  name?: string
  contactListId?: string
  scheduledAt?: Date
  resendTemplateId?: string | null
  resendTemplateName?: string | null
  fromName?: string | null
  fromEmail?: string | null
  replyTo?: string | null
}

export interface UpdateBackofficeEmailCampaignCountersInput {
  totalRecipients?: number
  totalSent?: number
  totalDelivered?: number
  totalOpened?: number
  totalClicked?: number
  totalBounced?: number
  totalComplained?: number
}

export interface IBackofficeEmailCampaignRepository {
  create(data: CreateBackofficeEmailCampaignInput): Promise<BackofficeEmailCampaign>
  findMany(): Promise<BackofficeEmailCampaign[]>
  findById(id: string): Promise<BackofficeEmailCampaign | null>
  findUpcomingLiveCampaign(): Promise<BackofficeEmailCampaign | null>
  findDueForDispatch(now: Date): Promise<BackofficeEmailCampaign[]>
  update(id: string, data: UpdateBackofficeEmailCampaignInput): Promise<BackofficeEmailCampaign>
  claimForDispatch(id: string): Promise<boolean>
  markSent(
    id: string,
    dispatchCount: number,
    counters: UpdateBackofficeEmailCampaignCountersInput
  ): Promise<BackofficeEmailCampaign>
  markFailed(id: string, errorMessage: string): Promise<BackofficeEmailCampaign>
  cancel(id: string): Promise<BackofficeEmailCampaign | null>
  recoverStuck(olderThan: Date): Promise<number>
  incrementCounters(
    id: string,
    counters: UpdateBackofficeEmailCampaignCountersInput
  ): Promise<void>
  updateStatus(id: string, status: BackofficeEmailCampaignStatus): Promise<void>
}
