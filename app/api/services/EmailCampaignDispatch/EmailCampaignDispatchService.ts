import {
  appendCampaignUnsubscribeFooter,
  buildCampaignUnsubscribeUrl,
  buildListUnsubscribeHeaders,
} from "@/lib/email/campaign-unsubscribe-footer"
import { buildResendBatchIdempotencyKey, resend } from "@/lib/email"
import { buildResendTrackingTags } from "@/lib/email/build-resend-tracking-tags"
import {
  interpolateEmailTemplate,
  type EmailTemplateVariableDefinition,
} from "@/lib/email/interpolate"
import type { IEmailCampaignDispatchService, DispatchBatchResult } from "./IEmailCampaignDispatchService"

const BATCH_SIZE = 100

/** Extrai IDs de e-mails da resposta do Resend batch (SDK v6). */
export function parseResendBatchSendItems(
  batchData: Array<{ id?: string }> | { data?: Array<{ id?: string }> } | null | undefined
): Array<{ id?: string }> {
  if (batchData == null) return []
  if (Array.isArray(batchData)) return batchData
  return batchData.data ?? []
}

export class EmailCampaignDispatchService implements IEmailCampaignDispatchService {
  async dispatchBatch(params: {
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
    dispatchNumber: number
    globalDefaults?: Record<string, string | null | undefined> | null
    templateVariables?: EmailTemplateVariableDefinition[] | null
    onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
  }): Promise<DispatchBatchResult> {
    if (!resend) {
      throw new Error("Resend não está configurado. Verifique a variável RESEND_API_KEY")
    }

    const result: DispatchBatchResult = { sent: 0, failed: 0, dispatched: [] }
    const chunks = this.chunkArray(params.recipients, BATCH_SIZE)

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      try {
        const batchPayload = chunk.map((recipient) => {
          const renderedHtml = interpolateEmailTemplate(
            params.html,
            recipient,
            params.globalDefaults,
            params.templateVariables
          )
          const renderedSubject = interpolateEmailTemplate(
            params.subject,
            recipient,
            params.globalDefaults,
            params.templateVariables
          )

          let htmlWithFooter = renderedHtml
          let headers: Record<string, string> | undefined

          if (recipient.contactId) {
            const unsubscribeUrl = buildCampaignUnsubscribeUrl(recipient.contactId, params.teamId)
            htmlWithFooter = appendCampaignUnsubscribeFooter(renderedHtml, unsubscribeUrl)
            headers = buildListUnsubscribeHeaders(unsubscribeUrl)
          }

          return {
            from: params.from,
            ...(params.replyTo ? { replyTo: params.replyTo } : {}),
            to: recipient.email,
            subject: renderedSubject,
            html: htmlWithFooter,
            ...(headers ? { headers } : {}),
            tags: buildResendTrackingTags({
              teamId: params.teamId,
              category: "campaign",
              sourceType: "campaign",
              sourceId: params.campaignId,
            }),
          }
        })

        const batchResult = await resend.batch.send(batchPayload, {
          idempotencyKey: buildResendBatchIdempotencyKey(
            "campaign",
            `${params.campaignId}/${params.dispatchNumber}/${chunkIndex}`
          ),
        })

        if (batchResult.error) {
          console.error("[EmailCampaignDispatchService][dispatchBatch] Erro da API Resend:", batchResult.error)
          result.failed += chunk.length
        } else {
          const items = parseResendBatchSendItems(batchResult.data)
          if (items.length === 0 && chunk.length > 0) {
            console.error(
              "[EmailCampaignDispatchService][dispatchBatch] Resposta sem IDs de e-mail para chunk",
              { campaignId: params.campaignId, chunkIndex, chunkSize: chunk.length }
            )
          }
          const chunkDispatched: Array<{ email: string; resendId: string }> = []
          items.forEach((item, idx) => {
            const recipient = chunk[idx]
            if (!recipient) return
            if (item?.id) {
              result.dispatched.push({ email: recipient.email, resendId: item.id })
              chunkDispatched.push({ email: recipient.email, resendId: item.id })
              result.sent++
            } else {
              result.failed++
            }
          })
          if (items.length < chunk.length) {
            result.failed += chunk.length - items.length
          }
          if (chunkDispatched.length > 0) {
            await params.onChunkDispatched?.(chunkDispatched)
          }
        }
      } catch (error) {
        console.error("[EmailCampaignDispatchService][dispatchBatch] Erro no batch:", error)
        result.failed += chunk.length
      }
    }

    return result
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}

export const emailCampaignDispatchService = new EmailCampaignDispatchService()
