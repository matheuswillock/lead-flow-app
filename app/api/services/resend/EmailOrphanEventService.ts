import { prisma } from "@/app/api/infra/data/prisma"
import { type ResendTrackingTagsInput } from "@/lib/email/build-resend-tracking-tags"
import { isBackofficeResendTags } from "@/lib/email/build-backoffice-resend-tags"
import {
  resendEmailEnrichmentService,
  type IResendEmailEnrichmentService,
} from "@/app/api/services/resend/ResendEmailEnrichmentService"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import { resendWebhookService } from "@/app/api/services/resend/ResendWebhookService"
import { radarService } from "@/app/api/services/radar/RadarService"
import type { ResendWebhookRadarEventPayload } from "@/lib/queues/resend-webhook-radar-events"

const RESEND_WEBHOOK_RADAR_QUEUE_PUBLISH_FAILED_TAG =
  "resend_webhook_radar_queue_publish_failed"

async function defaultPublishRadarEvent(
  payload: ResendWebhookRadarEventPayload
): Promise<{ messageId: string | null }> {
  const { publishResendWebhookRadarEvent } = await import(
    "@/lib/queues/resend-webhook-radar-events"
  )
  return publishResendWebhookRadarEvent(payload)
}

const BATCH_SIZE = 10
/** Lote do cron dedicado de dreno — 200 a cada 5 min = 2.400/h. */
export const ORPHAN_DRAIN_BATCH_SIZE = 200
const MAX_REQUESTS_PER_SECOND = 8
const MIN_INTERVAL_MS = Math.ceil(1000 / MAX_REQUESTS_PER_SECOND)
const MAX_ATTEMPTS = 5
/** Depois disso, um `processing` é assumido como execução morta e volta para a fila. */
const STALE_PROCESSING_MS = 10 * 60 * 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(message: string | null | undefined): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return normalized.includes("rate_limit") || normalized.includes("429")
}

export class EmailOrphanEventService {
  constructor(
    private readonly enrichmentService: IResendEmailEnrichmentService = resendEmailEnrichmentService,
    private readonly publishRadarEvent: (
      payload: ResendWebhookRadarEventPayload
    ) => Promise<{ messageId: string | null }> = defaultPublishRadarEvent
  ) {}

  async queueOrphanEvent(input: {
    resendEmailId: string
    resendEventType: string
    occurredAt: Date
    tagsHint?: ResendTrackingTagsInput
  }): Promise<void> {
    if (isBackofficeResendTags(input.tagsHint ?? null)) {
      return
    }

    // Uma linha por (e-mail, tipo, momento) — mesma chave de dedupe do
    // EmailEvent. A chave antiga era só o resendEmailId e fazia o segundo
    // evento do mesmo e-mail cair no `update: {}` e sumir.
    await prisma.emailOrphanEvent.upsert({
      where: {
        resendEmailId_resendEventType_occurredAt: {
          resendEmailId: input.resendEmailId,
          resendEventType: input.resendEventType,
          occurredAt: input.occurredAt,
        },
      },
      create: {
        resendEmailId: input.resendEmailId,
        resendEventType: input.resendEventType,
        occurredAt: input.occurredAt,
        tagsHint: input.tagsHint ?? undefined,
        status: "pending",
      },
      update: {},
    })
  }

  /** Devolve à fila o que ficou `processing` numa execução que morreu. */
  private async recoverStaleProcessingClaims(): Promise<void> {
    await prisma.emailOrphanEvent.updateMany({
      where: {
        status: "processing",
        updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) },
      },
      data: { status: "pending" },
    })
  }

  /**
   * Claim atômico: só entra no lote quem esta execução conseguiu tirar de
   * `pending`. Ordena por `occurredAt` para aplicar sent antes de delivered
   * antes de opened.
   */
  private async claimPendingBatch(limit: number) {
    await this.recoverStaleProcessingClaims()

    const due = await prisma.emailOrphanEvent.findMany({
      where: { status: "pending", attempts: { lt: MAX_ATTEMPTS } },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    })

    const claimed: typeof due = []
    for (const row of due) {
      const updated = await prisma.emailOrphanEvent.updateMany({
        where: { id: row.id, status: "pending" },
        data: { status: "processing" },
      })
      if (updated.count === 1) {
        claimed.push(row)
      }
    }
    return claimed
  }

  async processPendingBatch(
    limit: number = BATCH_SIZE,
  ): Promise<{ processed: number; failed: number; skipped: number }> {
    const pending = await this.claimPendingBatch(limit)

    let processed = 0
    let failed = 0
    let skipped = 0

    for (const event of pending) {
      const existingLog = await emailLogRepository.findByResendEmailId(event.resendEmailId)
      if (existingLog) {
        const eventType = resendWebhookService.mapEventType(event.resendEventType)
        if (eventType) {
          await resendWebhookService.processEmailLogWebhook({
            log: existingLog,
            eventType,
            occurredAt: event.occurredAt,
            metadata: {},
            resendEventType: event.resendEventType,
            svixId: null,
          })

          // Mesmos side effects Radar do fluxo normal (ResendWebhookUseCase), para opens/clicks/bounces recuperados.
          try {
            await this.publishRadarEvent({
              teamId: existingLog.teamId,
              recipientEmail: existingLog.recipientEmail,
              recipientName: existingLog.recipientName,
              logId: existingLog.id,
              campaignId: existingLog.campaignId,
              eventType,
              occurredAt: event.occurredAt.toISOString(),
              metadata: {},
              emailOrphanEventId: event.id,
            })
          } catch (publishError) {
            console.error(
              `[EmailOrphanEventService][radar] ${RESEND_WEBHOOK_RADAR_QUEUE_PUBLISH_FAILED_TAG}`,
              publishError
            )
            try {
              await radarService.handleEmailWebhookEvent({
                teamId: existingLog.teamId,
                recipientEmail: existingLog.recipientEmail,
                recipientName: existingLog.recipientName,
                logId: existingLog.id,
                campaignId: existingLog.campaignId,
                eventType,
                occurredAt: event.occurredAt,
                metadata: {},
              })
            } catch (radarError) {
              console.error("[EmailOrphanEventService][radar]", radarError)
            }
          }
        }
        await prisma.emailOrphanEvent.update({
          where: { id: event.id },
          data: { status: "processed", processedAt: new Date(), attempts: { increment: 1 } },
        })
        processed += 1
        await sleep(MIN_INTERVAL_MS)
        continue
      }

      let backoffMs = MIN_INTERVAL_MS
      let success = false
      let lastError: string | null = null
      let rateLimited = false

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const logId = await this.enrichmentService.createOrphanTeamEmailLogFromResendEmail(
            event.resendEmailId,
            event.occurredAt,
            event.tagsHint as ResendTrackingTagsInput
          )

          if (logId) {
            success = true
            break
          }

          lastError = "Não foi possível criar EmailLog órfão"
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Erro ao processar órfão"
          rateLimited = isRateLimitError(lastError)
          if (rateLimited) break
        }

        if (attempt < 2) {
          await sleep(backoffMs)
          backoffMs *= 2
        }
      }

      if (success) {
        await prisma.emailOrphanEvent.update({
          where: { id: event.id },
          data: {
            status: "processed",
            processedAt: new Date(),
            attempts: { increment: 1 },
          },
        })
        processed += 1
      } else if (rateLimited || isRateLimitError(lastError)) {
        await prisma.emailOrphanEvent.update({
          where: { id: event.id },
          data: {
            status: "pending",
            attempts: { increment: 1 },
            lastError,
          },
        })
        failed += 1
        await sleep(backoffMs)
      } else {
        const nextAttempts = event.attempts + 1
        const exhausted = nextAttempts >= MAX_ATTEMPTS
        const terminalStatus = exhausted ? "skipped" : "pending"
        if (exhausted) {
          console.info(
            `[EmailOrphanEventService] Órfão ${event.resendEmailId} ignorado após ${MAX_ATTEMPTS} tentativas: ${lastError ?? "sem team_id"}`
          )
        }
        await prisma.emailOrphanEvent.update({
          where: { id: event.id },
          data: {
            status: terminalStatus,
            attempts: { increment: 1 },
            lastError,
            ...(exhausted ? { processedAt: new Date() } : {}),
          },
        })
        if (exhausted) {
          skipped += 1
        }
      }

      await sleep(MIN_INTERVAL_MS)
    }

    return { processed, failed, skipped }
  }
}

export const emailOrphanEventService = new EmailOrphanEventService()
