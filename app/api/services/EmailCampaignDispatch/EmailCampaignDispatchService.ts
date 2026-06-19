import { buildResendBatchIdempotencyKey, resend } from "@/lib/email"
import { interpolateEmailTemplate } from "@/lib/email/interpolate"
import type { IEmailCampaignDispatchService, DispatchBatchResult } from "./IEmailCampaignDispatchService"

const BATCH_SIZE = 50

export class EmailCampaignDispatchService implements IEmailCampaignDispatchService {
  async dispatchBatch(params: {
    from: string
    replyTo?: string | null
    recipients: Array<{ email: string; name?: string | null; customFields?: Record<string, unknown> | null }>
    subject: string
    html: string
    campaignId: string
    teamId: string
    globalDefaults?: Record<string, string | null | undefined> | null
  }): Promise<DispatchBatchResult> {
    if (!resend) {
      throw new Error("Resend não está configurado. Verifique a variável RESEND_API_KEY")
    }

    const result: DispatchBatchResult = { sent: 0, failed: 0, dispatched: [] }
    const chunks = this.chunkArray(params.recipients, BATCH_SIZE)

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      try {
        const batchPayload = chunk.map((recipient) => ({
          from: params.from,
          ...(params.replyTo ? { replyTo: params.replyTo } : {}),
          to: recipient.email,
          subject: interpolateEmailTemplate(params.subject, recipient, params.globalDefaults),
          html: interpolateEmailTemplate(params.html, recipient, params.globalDefaults),
          tags: [
            { name: "campaignId", value: params.campaignId },
            { name: "teamId", value: params.teamId },
          ],
        }))

        const batchResult = await resend.batch.send(batchPayload, {
          idempotencyKey: buildResendBatchIdempotencyKey(
            "campaign",
            `${params.campaignId}/${chunkIndex}`
          ),
        })

        if (batchResult.data) {
          const items = Array.isArray(batchResult.data) ? batchResult.data : []
          items.forEach((item, idx) => {
            if (item?.id) {
              result.dispatched.push({ email: chunk[idx].email, resendId: item.id })
              result.sent++
            } else {
              result.failed++
            }
          })
        } else if (batchResult.error) {
          console.error("[EmailCampaignDispatchService][dispatchBatch] Erro da API Resend:", batchResult.error)
          result.failed += chunk.length
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
