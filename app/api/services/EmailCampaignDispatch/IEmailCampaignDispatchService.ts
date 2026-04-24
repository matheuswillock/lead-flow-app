export interface DispatchBatchResult {
  sent: number
  failed: number
  dispatched: Array<{ email: string; resendId: string }>
}

export interface DispatchRecipient {
  email: string
  name?: string
  customFields?: Record<string, unknown> | null
}

export interface IEmailCampaignDispatchService {
  dispatchBatch(params: {
    from: string
    recipients: DispatchRecipient[]
    subject: string
    html: string
    campaignId: string
    teamId: string
  }): Promise<DispatchBatchResult>
}
