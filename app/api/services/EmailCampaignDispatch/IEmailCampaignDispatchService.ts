export interface DispatchBatchResult {
  sent: number
  failed: number
  dispatched: Array<{ email: string; resendId: string }>
}

export interface IEmailCampaignDispatchService {
  dispatchBatch(params: {
    from: string
    recipients: Array<{ email: string; name?: string | null; customFields?: Record<string, unknown> | null }>
    subject: string
    html: string
    campaignId: string
    teamId: string
  }): Promise<DispatchBatchResult>
}
