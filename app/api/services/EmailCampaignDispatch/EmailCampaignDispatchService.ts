import {
  appendCampaignUnsubscribeFooter,
  buildCampaignUnsubscribeUrl,
  buildListUnsubscribeHeaders,
} from "@/lib/email/campaign-unsubscribe-footer"
import {
  EMAIL_UNSUBSCRIBE_LINK_VARIABLE_KEY,
  templateIncludesManualUnsubscribeLink,
} from "@/lib/email/unsubscribe-link-embed"
import { appendEmailLogIdToFormUrls } from "@/lib/email/append-email-log-to-form-urls"
import { buildResendBatchIdempotencyKey, resend } from "@/lib/email"
import { buildResendTrackingTags } from "@/lib/email/build-resend-tracking-tags"
import {
  interpolateEmailTemplate,
  type EmailTemplateVariableDefinition,
} from "@/lib/email/interpolate"
import {
  formatInvalidRecipientFailureMessage,
  isValidResendRecipientEmail,
} from "@/lib/email/is-valid-resend-recipient-email"
import type {
  DispatchBatchResult,
  DispatchProviderError,
  IEmailCampaignDispatchService,
} from "./IEmailCampaignDispatchService"

const BATCH_SIZE = 100

/** Traduz erros conhecidos do Resend para mensagens amigáveis ao usuário. */
function resolveResendBatchErrorMessage(rawMessage: string, statusCode?: number): string {
  if (statusCode === 403 && isDomainNotVerifiedError(rawMessage)) {
    return "Domínio de envio não verificado. Verifique os registros DNS nas configurações de e-mail."
  }
  if (statusCode === 409 && rawMessage.toLowerCase().includes("idempotency")) {
    return "Campanha já foi processada anteriormente. Se o problema persistir, entre em contato com o suporte."
  }
  return rawMessage
}

function isDomainNotVerifiedError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("not verified") || (lower.includes("domain") && lower.includes("verif"))
}

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
    dispatchId: string
    dispatchNumber: number
    globalDefaults?: Record<string, string | null | undefined> | null
    templateVariables?: EmailTemplateVariableDefinition[] | null
    logIdByEmail?: Map<string, string> | Record<string, string> | null
    onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
  }): Promise<DispatchBatchResult> {
    if (!resend) {
      throw new Error("Resend não está configurado. Verifique a variável RESEND_API_KEY")
    }

    const logIdByEmail =
      params.logIdByEmail instanceof Map
        ? params.logIdByEmail
        : params.logIdByEmail
          ? new Map(Object.entries(params.logIdByEmail))
          : null

    const result: DispatchBatchResult = {
      sent: 0,
      failed: 0,
      dispatched: [],
      providerErrors: [],
    }

    const sendable: typeof params.recipients = []
    const invalidLocalErrors: DispatchProviderError[] = []

    for (const recipient of params.recipients) {
      const validation = isValidResendRecipientEmail(recipient.email)
      if (!validation.ok) {
        result.failed += 1
        invalidLocalErrors.push({
          message: formatInvalidRecipientFailureMessage(recipient.email, validation.reason),
          emails: [recipient.email],
        })
        continue
      }
      sendable.push({ ...recipient, email: validation.email })
    }

    if (invalidLocalErrors.length > 0) {
      result.providerErrors.push(...invalidLocalErrors)
    }

    const chunks = this.chunkArray(sendable, BATCH_SIZE)

    const manualUnsubscribeLink = templateIncludesManualUnsubscribeLink(params.html)

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex]
      // Callback de persistência fica fora do try/catch do Resend: falha de DB após
      // aceite do chunk não pode ser engolida como "falha de batch" (sent sem resendEmailId).
      let chunkDispatched: Array<{ email: string; resendId: string }> = []

      try {
        const batchPayload = chunk.map((recipient) => {
          const unsubscribeUrl = recipient.contactId
            ? buildCampaignUnsubscribeUrl(recipient.contactId, params.teamId, params.campaignId)
            : ""
          const usesManualUnsubscribe = manualUnsubscribeLink && Boolean(unsubscribeUrl)
          let renderedHtml = interpolateEmailTemplate(
            params.html,
            recipient,
            params.globalDefaults,
            params.templateVariables,
            unsubscribeUrl
              ? { [EMAIL_UNSUBSCRIBE_LINK_VARIABLE_KEY]: unsubscribeUrl }
              : null,
          )
          const emailLogId = logIdByEmail?.get(recipient.email)
          if (emailLogId) {
            renderedHtml = appendEmailLogIdToFormUrls(renderedHtml, emailLogId)
          }
          const renderedSubject = interpolateEmailTemplate(
            params.subject,
            recipient,
            params.globalDefaults,
            params.templateVariables
          )

          let htmlWithFooter = renderedHtml
          let headers: Record<string, string> | undefined

          if (recipient.contactId && unsubscribeUrl) {
            if (!usesManualUnsubscribe) {
              htmlWithFooter = appendCampaignUnsubscribeFooter(renderedHtml, unsubscribeUrl)
            }
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
            `${params.dispatchId}/${chunkIndex}`
          ),
        })

        if (batchResult.error) {
          console.error("[EmailCampaignDispatchService][dispatchBatch] Erro da API Resend:", batchResult.error)
          result.failed += chunk.length
          const errorStatusCode =
            typeof batchResult.error.statusCode === "number"
              ? batchResult.error.statusCode
              : undefined
          const errorMessage = resolveResendBatchErrorMessage(
            batchResult.error.message || "Erro no envio via Resend",
            errorStatusCode
          )
          result.providerErrors.push({
            message: errorMessage,
            statusCode: errorStatusCode,
            emails: chunk.map((recipient) => recipient.email),
          })

          if (errorStatusCode === 403 && isDomainNotVerifiedError(batchResult.error.message ?? "")) {
            const remainingChunks = chunks.slice(chunkIndex + 1)
            const remainingCount = remainingChunks.reduce((sum, c) => sum + c.length, 0)
            result.failed += remainingCount
            result.abortedReason = "domain_not_verified"
            console.error(
              `[EmailCampaignDispatchService][dispatchBatch] Circuit breaker: domínio não verificado. Abortando ${remainingCount} destinatários restantes.`
            )
            break
          }
        } else {
          const items = parseResendBatchSendItems(batchResult.data)
          if (items.length === 0 && chunk.length > 0) {
            console.error(
              "[EmailCampaignDispatchService][dispatchBatch] Resposta sem IDs de e-mail para chunk",
              { campaignId: params.campaignId, chunkIndex, chunkSize: chunk.length }
            )
          }
          items.forEach((item, idx) => {
            const recipient = chunk[idx]
            if (!recipient) return
            if (item?.id) {
              result.dispatched.push({ email: recipient.email, resendId: item.id })
              chunkDispatched.push({ email: recipient.email, resendId: item.id })
              result.sent++
            } else {
              result.failed++
              result.providerErrors.push({
                message: "Resposta do Resend sem ID de e-mail",
                emails: [recipient.email],
              })
            }
          })
          if (items.length < chunk.length) {
            const missing = chunk.slice(items.length)
            result.failed += missing.length
            if (missing.length > 0) {
              result.providerErrors.push({
                message: "Resposta do Resend incompleta para o lote",
                emails: missing.map((recipient) => recipient.email),
              })
            }
          }
        }
      } catch (error) {
        console.error("[EmailCampaignDispatchService][dispatchBatch] Erro no batch:", error)
        result.failed += chunk.length
        result.providerErrors.push({
          message: error instanceof Error ? error.message : "Erro no envio via Resend",
          emails: chunk.map((recipient) => recipient.email),
        })
        chunkDispatched = []
        continue
      }

      if (chunkDispatched.length > 0) {
        await params.onChunkDispatched?.(chunkDispatched)
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
