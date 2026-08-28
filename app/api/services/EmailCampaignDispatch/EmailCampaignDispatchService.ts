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
  buildCampaignBatchIdempotencyEntityId,
  type EmailCampaignBatchIdempotencyScheme,
} from "@/lib/email/resend-campaign-batch-idempotency-key"
import {
  isResendMonthlyQuotaExceeded,
  isRetryableResendBatchError,
  MAX_BATCH_SEND_ATTEMPTS,
  resendBatchRetryBackoffMs,
} from "@/lib/email/is-retryable-resend-batch-error"
import { logResendMonthlyQuotaIncident } from "@/lib/email/resend-quota-incident"
import { buildResendTrackingTags } from "@/lib/email/build-resend-tracking-tags"
import {
  interpolateEmailTemplate,
  type EmailTemplateVariableDefinition,
} from "@/lib/email/interpolate"
import {
  formatInvalidRecipientFailureMessage,
} from "@/lib/email/is-valid-resend-recipient-email"
import { evaluateEmailForAudience } from "@/lib/email/audience-prevalidation"
import {
  formatResendInvalidToIsolatedFailureMessage,
  isResendInvalidToValidationError,
  splitBatchForInvalidToBisect,
} from "@/lib/email/resend-batch-invalid-to-bisect"
import type {
  DispatchBatchResult,
  DispatchProviderError,
  IEmailCampaignDispatchService,
} from "./IEmailCampaignDispatchService"

const BATCH_SIZE = 100
/** Limite de sublotes enfileirados por bisect (proteção contra loop). */
const MAX_INVALID_TO_BISECT_QUEUE = BATCH_SIZE * 2

/**
 * Concorrência de chunks de 100 destinatários dentro do mesmo `dispatchBatch`
 * (cada chunk é 1 chamada `resend.batch.send`). Default 1 preserva o
 * comportamento sequencial atual — só subir depois de confirmar o rate limit
 * real da conta no dashboard da Resend (header `ratelimit-limit` na resposta
 * da API; default documentado hoje é 10 req/s por time, mas pode variar por
 * plano). Não consome orçamento de conexão Postgres: os chunks concorrentes
 * seguem no mesmo isolate/consumer da fila `email-campaign-dispatch`
 * (`maxConcurrency: 4` em `vercel.json`; o mesmo `dispatchId` permanece
 * serial via advisory lock), com o mesmo Prisma client.
 */
function resolveDispatchChunkConcurrency(): number {
  const raw = Number(process.env.EMAIL_DISPATCH_CHUNK_CONCURRENCY ?? 1)
  if (!Number.isFinite(raw) || raw < 1) return 1
  return Math.trunc(raw)
}

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

function isIdempotencyConflictError(statusCode?: number, message?: string): boolean {
  return statusCode === 409 && (message?.toLowerCase().includes("idempotency") ?? false)
}

function buildBatchIdempotencyEntityIdAttempts(params: {
  scheme: EmailCampaignBatchIdempotencyScheme
  enableContentHashFallbackOnIdempotencyConflict: boolean
  dispatchId: string
  chunkIndex: number
  chunkEmails: string[]
}): string[] {
  const contentHashEntityId = buildCampaignBatchIdempotencyEntityId({
    scheme: "contentHash",
    dispatchId: params.dispatchId,
    chunkIndex: params.chunkIndex,
    recipientEmails: params.chunkEmails,
  })

  if (params.scheme === "contentHash") {
    return [contentHashEntityId]
  }

  const positionalEntityId = buildCampaignBatchIdempotencyEntityId({
    scheme: "positional",
    dispatchId: params.dispatchId,
    chunkIndex: params.chunkIndex,
    recipientEmails: params.chunkEmails,
  })

  if (
    params.enableContentHashFallbackOnIdempotencyConflict &&
    positionalEntityId !== contentHashEntityId
  ) {
    return [positionalEntityId, contentHashEntityId]
  }

  return [positionalEntityId]
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
    batchIdempotencyScheme?: EmailCampaignBatchIdempotencyScheme
    enableContentHashFallbackOnIdempotencyConflict?: boolean
    globalDefaults?: Record<string, string | null | undefined> | null
    templateVariables?: EmailTemplateVariableDefinition[] | null
    logIdByEmail?: Map<string, string> | Record<string, string> | null
    onChunkDispatched?: (entries: Array<{ email: string; resendId: string }>) => Promise<void>
  }): Promise<DispatchBatchResult> {
    if (!resend) {
      throw new Error("Resend não está configurado. Verifique a variável RESEND_API_KEY")
    }
    // Captura local narrowed: `processChunkItem` roda em workers concorrentes (closure),
    // e o TS não propaga o `if (!resend)` acima para dentro de funções aninhadas.
    const resendClient = resend

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

    let abortRemainingChunks = false

    const sendable: typeof params.recipients = []
    const invalidLocalErrors: DispatchProviderError[] = []

    for (const recipient of params.recipients) {
      const validation = evaluateEmailForAudience(recipient.email)
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

    const batchIdempotencyScheme = params.batchIdempotencyScheme ?? "contentHash"
    const enableContentHashFallbackOnIdempotencyConflict =
      params.enableContentHashFallbackOnIdempotencyConflict ?? false

    type Recipient = (typeof sendable)[number]
    type ChunkWorkItem = { sortedChunk: Recipient[]; chunkIndex: number }

    const chunkQueue: ChunkWorkItem[] = chunks.map((chunk, chunkIndex) => ({
      sortedChunk: [...chunk].sort((a, b) =>
        a.email.localeCompare(b.email, undefined, { sensitivity: "base" })
      ),
      chunkIndex,
    }))

    const processChunkItem = async ({ sortedChunk, chunkIndex }: ChunkWorkItem): Promise<void> => {
      if (sortedChunk.length === 0) return

      const chunkEmails = sortedChunk.map((recipient) => recipient.email)
      const entityIdAttempts = buildBatchIdempotencyEntityIdAttempts({
        scheme: batchIdempotencyScheme,
        enableContentHashFallbackOnIdempotencyConflict,
        dispatchId: params.dispatchId,
        chunkIndex,
        chunkEmails,
      })
      // Callback de persistência fica fora do try/catch do Resend: falha de DB após
      // aceite do chunk não pode ser engolida como "falha de batch" (sent sem resendEmailId).
      let chunkDispatched: Array<{ email: string; resendId: string }> = []

      const batchPayload = sortedChunk.map((recipient) => {
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
      let shouldBisectInvalidTo = false
      entityIdLoop: for (const batchIdempotencyEntityId of entityIdAttempts) {
        for (let attempt = 0; attempt < MAX_BATCH_SEND_ATTEMPTS; attempt++) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, resendBatchRetryBackoffMs(attempt)))
          }

          try {
            const idempotencyKey =
              attempt === 0
                ? buildResendBatchIdempotencyKey("campaign", batchIdempotencyEntityId)
                : buildResendIdempotencyKeyWithVariant(
                    "batch-campaign",
                    batchIdempotencyEntityId,
                    `attempt-${attempt}`,
                  )

            const batchResult = await resendClient.batch.send(batchPayload, { idempotencyKey })

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
                batchIdempotencyEntityId,
                attempt: attempt + 1,
                statusCode: errorStatusCode,
                chunkSize: sortedChunk.length,
              })
              const errorName =
                typeof batchResult.error.name === "string" ? batchResult.error.name : undefined
              const retryable = isRetryableResendBatchError({
                statusCode: errorStatusCode,
                message: errorMessage,
                name: errorName,
              })
              const idempotencyConflict = isIdempotencyConflictError(
                errorStatusCode,
                batchResult.error.message
              )
              if (!retryable || attempt === MAX_BATCH_SEND_ATTEMPTS - 1) {
                if (
                  idempotencyConflict &&
                  batchIdempotencyEntityId !== entityIdAttempts[entityIdAttempts.length - 1]
                ) {
                  continue entityIdLoop
                }
                if (
                  isResendInvalidToValidationError(errorStatusCode, errorMessage) &&
                  sortedChunk.length > 1
                ) {
                  shouldBisectInvalidTo = true
                  chunkDispatched = []
                  break entityIdLoop
                }
                if (
                  isResendInvalidToValidationError(errorStatusCode, errorMessage) &&
                  sortedChunk.length === 1
                ) {
                  const alone = sortedChunk[0]!
                  result.failed += 1
                  result.providerErrors.push({
                    message: formatResendInvalidToIsolatedFailureMessage(alone.email),
                    statusCode: errorStatusCode,
                    emails: [alone.email],
                  })
                  chunkDispatched = []
                  break entityIdLoop
                }
                if (
                  isResendMonthlyQuotaExceeded({
                    statusCode: errorStatusCode,
                    message: errorMessage,
                    name: errorName,
                  })
                ) {
                  // 429 de rate limit continua retentando (ver
                  // `isRetryableResendBatchError`); 429 de cota aborta. A tag
                  // aqui é o que transforma o aborto em incidente alertável em
                  // vez de mais uma linha de `failed` no meio de 98.884.
                  logResendMonthlyQuotaIncident({
                    surface: "campaign_dispatch",
                    teamId: params.teamId,
                    campaignId: params.campaignId,
                    dispatchId: params.dispatchId,
                    recipientCount: sortedChunk.length,
                    message: errorMessage,
                  })
                  result.abortedReason = "monthly_quota_exceeded"
                  abortRemainingChunks = true
                  chunkQueue.length = 0
                }
                result.failed += sortedChunk.length
                result.providerErrors.push({
                  message: errorMessage,
                  statusCode: errorStatusCode,
                  emails: sortedChunk.map((recipient) => recipient.email),
                })
                chunkDispatched = []
                break entityIdLoop
              }
              continue
            }

            const items = parseResendBatchSendItems(batchResult.data)
            if (items.length === 0 && sortedChunk.length > 0) {
              console.error(
                "[EmailCampaignDispatchService][dispatchBatch] Resposta sem IDs de e-mail para chunk",
                { campaignId: params.campaignId, chunkIndex, chunkSize: sortedChunk.length }
              )
            }
            chunkDispatched = []
            items.forEach((item, idx) => {
              const recipient = sortedChunk[idx]
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
            if (items.length < sortedChunk.length) {
              const missing = sortedChunk.slice(items.length)
              result.failed += missing.length
              if (missing.length > 0) {
                result.providerErrors.push({
                  message: "Resposta do Resend incompleta para o lote",
                  emails: missing.map((recipient) => recipient.email),
                })
              }
            }
            chunkAccepted = true
            break entityIdLoop
          } catch (error) {
            console.error("[EmailCampaignDispatchService][dispatchBatch] Erro no batch:", error)
            const message = error instanceof Error ? error.message : "Erro no envio via Resend"
            console.info("[EmailCampaignDispatchService][dispatchBatch] tentativa de lote (exceção)", {
              campaignId: params.campaignId,
              dispatchId: params.dispatchId,
              chunkIndex,
              batchIdempotencyEntityId,
              attempt: attempt + 1,
            })
            const retryable = isRetryableResendBatchError({ message })
            if (!retryable || attempt === MAX_BATCH_SEND_ATTEMPTS - 1) {
              result.failed += sortedChunk.length
              result.providerErrors.push({
                message,
                emails: sortedChunk.map((recipient) => recipient.email),
              })
              chunkDispatched = []
              break entityIdLoop
            }
          }
        }
      }

      if (shouldBisectInvalidTo) {
        const [left, right] = splitBatchForInvalidToBisect(sortedChunk)
        console.info("[EmailCampaignDispatchService][dispatchBatch] bisect Invalid to", {
          campaignId: params.campaignId,
          dispatchId: params.dispatchId,
          chunkIndex,
          originalSize: sortedChunk.length,
          leftSize: left.length,
          rightSize: right.length,
          queueSize: chunkQueue.length,
        })
        if (chunkQueue.length + 2 > MAX_INVALID_TO_BISECT_QUEUE) {
          console.error(
            "[EmailCampaignDispatchService][dispatchBatch] limite de bisect atingido; falhando lote",
            { campaignId: params.campaignId, dispatchId: params.dispatchId, chunkIndex }
          )
          result.failed += sortedChunk.length
          result.providerErrors.push({
            message:
              "Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.",
            statusCode: 422,
            emails: sortedChunk.map((recipient) => recipient.email),
          })
          return
        }
        // Processa esquerda antes da direita (DFS).
        if (right.length > 0) {
          chunkQueue.unshift({ sortedChunk: right, chunkIndex })
        }
        if (left.length > 0) {
          chunkQueue.unshift({ sortedChunk: left, chunkIndex })
        }
        return
      }

      if (!chunkAccepted && chunkDispatched.length === 0) {
        return
      }

      if (chunkDispatched.length > 0) {
        await params.onChunkDispatched?.(chunkDispatched)
      }
    }

    const concurrency = resolveDispatchChunkConcurrency()
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (chunkQueue.length > 0 && !abortRemainingChunks) {
          const item = chunkQueue.shift()
          if (!item) break
          await processChunkItem(item)
        }
      })
    )

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
