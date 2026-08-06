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
import {
  buildResendBatchIdempotencyKey,
  buildResendIdempotencyKeyWithVariant,
  resend,
} from "@/lib/email"
import {
  isRetryableResendBatchError,
  MAX_BATCH_SEND_ATTEMPTS,
  resendBatchRetryBackoffMs,
} from "@/lib/email/is-retryable-resend-batch-error"
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

      let chunkAccepted = false
      for (let attempt = 0; attempt < MAX_BATCH_SEND_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, resendBatchRetryBackoffMs(attempt)))
        }

        try {
          const idempotencyKey =
            attempt === 0
              ? buildResendBatchIdempotencyKey("campaign", `${params.dispatchId}/${chunkIndex}`)
              : buildResendIdempotencyKeyWithVariant(
                  "batch-campaign",
                  `${params.dispatchId}/${chunkIndex}`,
                  `attempt-${attempt}`,
                )

          const batchResult = await resend.batch.send(batchPayload, { idempotencyKey })

          if (batchResult.error) {
            console.error("[EmailCampaignDispatchService][dispatchBatch] Erro da API Resend:", batchResult.error)
            const errorStatusCode =
              typeof batchResult.error.statusCode === "number"
                ? batchResult.error.statusCode
                : undefined
            const errorMessage = resolveResendBatchErrorMessage(
              batchResult.error.message || "Erro no envio via Resend",
              errorStatusCode
            )
            console.info("[EmailCampaignDispatchService][dispatchBatch] tentativa de lote", {
              campaignId: params.campaignId,
              dispatchId: params.dispatchId,
              chunkIndex,
              attempt: attempt + 1,
              statusCode: errorStatusCode,
            })
            const retryable = isRetryableResendBatchError({
              statusCode: errorStatusCode,
              message: errorMessage,
            })
            if (!retryable || attempt === MAX_BATCH_SEND_ATTEMPTS - 1) {
              result.failed += chunk.length
              result.providerErrors.push({
                message: errorMessage,
                statusCode: errorStatusCode,
                emails: chunk.map((recipient) => recipient.email),
              })
              chunkDispatched = []
              break
            }
            continue
          }

          const items = parseResendBatchSendItems(batchResult.data)
          if (items.length === 0 && chunk.length > 0) {
            console.error(
              "[EmailCampaignDispatchService][dispatchBatch] Resposta sem IDs de e-mail para chunk",
              { campaignId: params.campaignId, chunkIndex, chunkSize: chunk.length }
            )
          }
          chunkDispatched = []
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
          chunkAccepted = true
          break
        } catch (error) {
          console.error("[EmailCampaignDispatchService][dispatchBatch] Erro no batch:", error)
          const message = error instanceof Error ? error.message : "Erro no envio via Resend"
          console.info("[EmailCampaignDispatchService][dispatchBatch] tentativa de lote (exceção)", {
            campaignId: params.campaignId,
            dispatchId: params.dispatchId,
            chunkIndex,
            attempt: attempt + 1,
          })
          const retryable = isRetryableResendBatchError({ message })
          if (!retryable || attempt === MAX_BATCH_SEND_ATTEMPTS - 1) {
            result.failed += chunk.length
            result.providerErrors.push({
              message,
              emails: chunk.map((recipient) => recipient.email),
            })
            chunkDispatched = []
            break
          }
        }
      }

      if (!chunkAccepted && chunkDispatched.length === 0) {
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
