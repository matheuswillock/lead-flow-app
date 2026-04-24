import { resend } from "@/lib/email"
import type {
  DispatchBatchResult,
  DispatchRecipient,
  IEmailCampaignDispatchService,
} from "./IEmailCampaignDispatchService"

const BATCH_SIZE = 50

export class EmailCampaignDispatchService implements IEmailCampaignDispatchService {
  async dispatchBatch(params: {
    from: string
    recipients: DispatchRecipient[]
    subject: string
    html: string
    campaignId: string
    teamId: string
  }): Promise<DispatchBatchResult> {
    if (!resend) {
      throw new Error("Resend não está configurado. Verifique a variável RESEND_API_KEY")
    }

    const result: DispatchBatchResult = { sent: 0, failed: 0, dispatched: [] }
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

  /**
   * Interpola variáveis no formato {{variavel}} com os dados do destinatário
   */
  private interpolateVariables(template: string, recipient: DispatchRecipient): string {
    const resolvedValues = new Map<string, string>()

    if (recipient.name?.trim()) {
      resolvedValues.set("name", recipient.name.trim())
      resolvedValues.set("nome", recipient.name.trim())
    }

    resolvedValues.set("email", recipient.email)

    if (recipient.customFields && typeof recipient.customFields === "object") {
      for (const [key, value] of Object.entries(recipient.customFields)) {
        const serializedValue =
          typeof value === "string"
            ? value
            : typeof value === "number" || typeof value === "boolean"
              ? String(value)
              : ""

        if (serializedValue.trim().length === 0) {
          continue
        }

        const lowerKey = key.trim().toLowerCase()
        if (!lowerKey) {
          continue
        }

        resolvedValues.set(lowerKey, serializedValue)
        resolvedValues.set(this.normalizeTokenKey(lowerKey), serializedValue)
      }
    }

    return template.replace(/\{\{\s*([^,}]+?)(?:\s*,\s*fallback=([^}]*))?\s*\}\}/gi, (_match, rawKey, rawFallback) => {
      const key = String(rawKey || "").trim()
      const fallback = typeof rawFallback === "string" ? rawFallback.trim() : ""

      if (!key) {
        return fallback
      }

      const normalizedKey = this.normalizeTokenKey(key)
      const resolvedValue =
        resolvedValues.get(key.toLowerCase()) ??
        resolvedValues.get(normalizedKey) ??
        ""

      return resolvedValue.trim().length > 0 ? resolvedValue : fallback
    })
  }

  private normalizeTokenKey(value: string): string {
    return value
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase()
  }
}

export const emailCampaignDispatchService = new EmailCampaignDispatchService()
