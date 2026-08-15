import type {
  BackofficeEmailCampaignDispatch,
  BackofficeEmailCampaignDispatchStatus,
} from "@prisma/client"

export interface CreateBackofficeEmailCampaignDispatchInput {
  campaignId: string
  templateSubjectSnapshot: string
  templateHtmlSnapshot: string
  resendTemplateIdSnapshot?: string | null
  triggeredByBackofficeUserId?: string | null
}

export interface UpdateBackofficeEmailCampaignDispatchCountersInput {
  totalRecipients?: number
  totalSent?: number
  totalDelivered?: number
  totalOpened?: number
  totalClicked?: number
  totalBounced?: number
  totalComplained?: number
}

export interface IBackofficeEmailCampaignDispatchRepository {
  create(data: CreateBackofficeEmailCampaignDispatchInput): Promise<BackofficeEmailCampaignDispatch>
  findById(id: string): Promise<BackofficeEmailCampaignDispatch | null>
  findByCampaignId(campaignId: string): Promise<BackofficeEmailCampaignDispatch[]>
  updateStatus(
    id: string,
    status: BackofficeEmailCampaignDispatchStatus,
    errorMessage?: string | null
  ): Promise<void>
  updateCounters(
    id: string,
    counters: UpdateBackofficeEmailCampaignDispatchCountersInput
  ): Promise<void>
  incrementCounters(
    id: string,
    counters: UpdateBackofficeEmailCampaignDispatchCountersInput
  ): Promise<void>
}
