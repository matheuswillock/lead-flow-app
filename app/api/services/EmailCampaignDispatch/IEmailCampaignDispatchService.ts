import type { EmailTemplateVariableDefinition } from "@/lib/email/interpolate"

export interface DispatchBatchResult {
  sent: number
  failed: number
  dispatched: Array<{ email: string; resendId: string }>
}

export interface IEmailCampaignDispatchService {
  dispatchBatch(params: {
    from: string
    replyTo?: string | null
    recipients: Array<{ email: string; name?: string | null; customFields?: Record<string, unknown> | null }>
    subject: string
    html: string
    campaignId: string
    teamId: string
    dispatchNumber: number
    globalDefaults?: Record<string, string | null | undefined> | null
    templateVariables?: EmailTemplateVariableDefinition[] | null
  }): Promise<DispatchBatchResult>
}
