import type { EmailTemplateVariableDefinition } from "@/lib/email/interpolate"
import type { EmailCampaignBatchIdempotencyScheme } from "@/lib/email/resend-campaign-batch-idempotency-key"

export type DispatchProviderError = {
  message: string
  emails: string[]
  statusCode?: number
}

export interface DispatchBatchResult {
  sent: number
  failed: number
  dispatched: Array<{ email: string; resendId: string }>
  providerErrors: DispatchProviderError[]
  abortedReason?: "domain_not_verified"
}

export interface IEmailCampaignDispatchService {
  dispatchBatch(params: {
    from: string
    replyTo?: string | null
    recipients: Array<{
      contactId?: string | null
      email: string
      name?: string | null
      customFields?: Record<string, unknown> | null
    }>
    subject: string
    html: string
    campaignId: string
    teamId: string
    dispatchId: string
    dispatchNumber: number
    /** positional = legado (dispatches in-flight); contentHash = D13 Opção B (novos dispatches). */
    batchIdempotencyScheme?: EmailCampaignBatchIdempotencyScheme
    /** Só para scheme positional: após 409 idempotency esgotar variantes, retenta com contentHash (E4). */
    enableContentHashFallbackOnIdempotencyConflict?: boolean
    globalDefaults?: Record<string, string | null | undefined> | null
    templateVariables?: EmailTemplateVariableDefinition[] | null
    /** Map e-mail → EmailLog.id para injetar `cs_el` em links de formulário. */
    logIdByEmail?: Map<string, string> | Record<string, string> | null
    /** Chamado imediatamente após cada chunk ser aceito pelo Resend, antes do próximo chunk.
     *  Permite salvar resendEmailIds no banco antes que os webhooks de entrega cheguem. */
    onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
  }): Promise<DispatchBatchResult>
}
