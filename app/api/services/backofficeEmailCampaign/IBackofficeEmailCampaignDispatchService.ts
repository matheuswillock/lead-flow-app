export interface BackofficeEmailDispatchRecipient {
  logId: string
  contactId: string
  email: string
  name?: string | null
}

export interface DispatchBackofficeEmailCampaignBatchParams {
  campaignId: string
  dispatchId: string
  dispatchNumber: number
  from: string
  replyTo?: string | null
  subject: string
  html: string
  recipients: BackofficeEmailDispatchRecipient[]
}

export interface DispatchBackofficeEmailCampaignBatchResult {
  sent: number
  failed: number
}

export interface IBackofficeEmailCampaignDispatchService {
  dispatchBatch(
    params: DispatchBackofficeEmailCampaignBatchParams
  ): Promise<DispatchBackofficeEmailCampaignBatchResult>
}
