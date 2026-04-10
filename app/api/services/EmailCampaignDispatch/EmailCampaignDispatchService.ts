import { resend } from "@/lib/email"
import type { IEmailCampaignDispatchService, DispatchBatchResult } from "./IEmailCampaignDispatchService"

const BATCH_SIZE = 50

export class EmailCampaignDispatchService implements IEmailCampaignDispatchService {
  async dispatchBatch(params: {
    from: string
    recipients: Array<{ email: string; name?: string }>
    subject: string
    html: string
    campaignId: string
    teamId: string
  }): Promise<DispatchBatchResult> {
    if (!resend) {
      throw new Error("Resend não está configurado. Verifique a variável RESEND_API_KEY")
    }

    const result: DispatchBatchResult = { sent: 0, failed: 0, resendIds: [] }
    const chunks = this.chunkArray(params.recipients, BATCH_SIZE)

    for (const chunk of chunks) {
      try {
        const batchPayload = chunk.map((recipient) => ({
          from: params.from,
          to: recipient.email,
          subject: this.interpolateVariables(params.subject, recipient),
          html: this.interpolateVariables(params.html, recipient),
          tags: [
            { name: "campaignId", value: params.campaignId },
            { name: "teamId", value: params.teamId },
          ],
        }))

        const batchResult = await resend.batch.send(batchPayload)

        if (batchResult.data) {
          const items = Array.isArray(batchResult.data) ? batchResult.data : []
          for (const item of items) {
            if (item && item.id) {
              result.resendIds.push(item.id)
              result.sent++
            } else {
              result.failed++
            }
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

  /**
   * Interpola variáveis no formato {{variavel}} com os dados do destinatário
   */
  private interpolateVariables(
    template: string,
    recipient: { email: string; name?: string }
  ): string {
    return template
      .replace(/\{\{nome\}\}/gi, recipient.name ?? "")
      .replace(/\{\{name\}\}/gi, recipient.name ?? "")
      .replace(/\{\{email\}\}/gi, recipient.email)
  }
}

export const emailCampaignDispatchService = new EmailCampaignDispatchService()
