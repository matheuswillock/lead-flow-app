import type { EmailOrphanEvent } from "@prisma/client"
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

type ClaimedOrphanEvent = EmailOrphanEvent

type ExistingEmailLog = NonNullable<
  Awaited<ReturnType<typeof emailLogRepository.findByResendEmailId>>
>

type BatchCounters = { processed: number; failed: number; skipped: number }

type EnrichmentAttempt = {
  success: boolean
  rateLimited: boolean
  lastError: string | null
  backoffMs: number
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
      // `updatedAt` explícito: é ele que carimba o início do lease de 10 min
      // lido por `recoverStaleProcessingClaims`. O Prisma 6.19 já preenche
      // `@updatedAt` em `updateMany` (medido), mas o lease é regra de negócio
      // e não pode depender de um detalhe do gerador — o precedente do repo
      // (`EmailContactRadarSyncOutboxRepository.claimDue`) também é explícito.
      const updated = await prisma.emailOrphanEvent.updateMany({
        where: { id: row.id, status: "pending" },
        data: { status: "processing", updatedAt: new Date() },
      })
      if (updated.count === 1) {
        claimed.push(row)
      }
    }
    return claimed
  }

  /**
   * Aplica o evento órfão ao `EmailLog` pelo mesmo caminho do webhook normal,
   * com os mesmos side effects de Radar. É o que faz um `email.complained`
   * recuperado valer tanto quanto um que chegou com o log já existindo.
   */
  private async applyEventToLog(log: ExistingEmailLog, event: ClaimedOrphanEvent): Promise<void> {
    const eventType = resendWebhookService.mapEventType(event.resendEventType)
    if (!eventType) return

    await resendWebhookService.processEmailLogWebhook({
      log,
      eventType,
      occurredAt: event.occurredAt,
      metadata: {},
      resendEventType: event.resendEventType,
      svixId: null,
    })

    // Mesmos side effects Radar do fluxo normal (ResendWebhookUseCase), para opens/clicks/bounces recuperados.
    try {
      await this.publishRadarEvent({
        teamId: log.teamId,
        recipientEmail: log.recipientEmail,
        recipientName: log.recipientName,
        logId: log.id,
        campaignId: log.campaignId,
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
          teamId: log.teamId,
          recipientEmail: log.recipientEmail,
          recipientName: log.recipientName,
          logId: log.id,
          campaignId: log.campaignId,
          eventType,
          occurredAt: event.occurredAt,
          metadata: {},
        })
      } catch (radarError) {
        console.error("[EmailOrphanEventService][radar]", radarError)
      }
    }
  }

  /** Cria o `EmailLog` a partir da API do Resend, com backoff próprio. */
  private async createLogWithRetry(event: ClaimedOrphanEvent): Promise<EnrichmentAttempt> {
    let backoffMs = MIN_INTERVAL_MS
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
          return { success: true, rateLimited: false, lastError: null, backoffMs }
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

    return {
      success: false,
      rateLimited: rateLimited || isRateLimitError(lastError),
      lastError,
      backoffMs,
    }
  }

  private async markProcessed(id: string): Promise<void> {
    await prisma.emailOrphanEvent.update({
      where: { id },
      data: { status: "processed", processedAt: new Date(), attempts: { increment: 1 } },
    })
  }

  private async processClaimedEvent(
    event: ClaimedOrphanEvent,
    counters: BatchCounters
  ): Promise<void> {
    const existingLog = await emailLogRepository.findByResendEmailId(event.resendEmailId)
    if (existingLog) {
      await this.applyEventToLog(existingLog, event)
      await this.markProcessed(event.id)
      counters.processed += 1
      return
    }

    const enrichment = await this.createLogWithRetry(event)

    if (enrichment.success) {
      // O enrichment cria o log já em `sent`. Sem aplicar o evento corrente,
      // um `email.complained`/`email.failed` que seja o ÚNICO webhook daquele
      // e-mail sumia: o log ficava `sent` e a reclamação nunca era registrada
      // — exatamente a conformidade que este estágio existe para garantir.
      const createdLog = await emailLogRepository.findByResendEmailId(event.resendEmailId)
      if (createdLog) {
        await this.applyEventToLog(createdLog, event)
      } else {
        console.error(
          `[EmailOrphanEventService] EmailLog criado mas não encontrado para ${event.resendEmailId}; evento ${event.resendEventType} não aplicado`
        )
      }
      await this.markProcessed(event.id)
      counters.processed += 1
      return
    }

    if (enrichment.rateLimited) {
      await prisma.emailOrphanEvent.update({
        where: { id: event.id },
        data: { status: "pending", attempts: { increment: 1 }, lastError: enrichment.lastError },
      })
      counters.failed += 1
      await sleep(enrichment.backoffMs)
      return
    }

    const exhausted = event.attempts + 1 >= MAX_ATTEMPTS
    if (exhausted) {
      console.info(
        `[EmailOrphanEventService] Órfão ${event.resendEmailId} ignorado após ${MAX_ATTEMPTS} tentativas: ${enrichment.lastError ?? "sem team_id"}`
      )
    }
    await prisma.emailOrphanEvent.update({
      where: { id: event.id },
      data: {
        status: exhausted ? "skipped" : "pending",
        attempts: { increment: 1 },
        lastError: enrichment.lastError,
        ...(exhausted ? { processedAt: new Date() } : {}),
      },
    })
    if (exhausted) {
      counters.skipped += 1
    }
  }

  /**
   * Devolve uma linha a `pending` depois de um erro que o fluxo normal não
   * previu. Nunca relança: se a liberação falhasse aqui, o lote abortaria e as
   * linhas seguintes voltariam a ficar presas — o problema que ela resolve.
   */
  private async releaseAfterUnexpectedError(
    event: ClaimedOrphanEvent,
    error: unknown
  ): Promise<boolean> {
    const message = error instanceof Error ? error.message : "Erro inesperado ao processar órfão"
    const exhausted = event.attempts + 1 >= MAX_ATTEMPTS
    try {
      await prisma.emailOrphanEvent.update({
        where: { id: event.id },
        data: {
          status: exhausted ? "skipped" : "pending",
          attempts: { increment: 1 },
          lastError: message,
          ...(exhausted ? { processedAt: new Date() } : {}),
        },
      })
      return true
    } catch (releaseError) {
      console.error(
        `[EmailOrphanEventService] Falha ao liberar o claim do órfão ${event.id}`,
        releaseError
      )
      return false
    }
  }

  /** Rede de segurança: nada reivindicado por esta execução fica em `processing`. */
  private async releaseUnfinishedClaims(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    try {
      await prisma.emailOrphanEvent.updateMany({
        where: { id: { in: ids }, status: "processing" },
        data: { status: "pending", updatedAt: new Date() },
      })
      console.info(
        `[EmailOrphanEventService] ${ids.length} claim(s) devolvido(s) a pending após interrupção do lote`
      )
    } catch (releaseError) {
      console.error(
        "[EmailOrphanEventService] Falha ao devolver claims não processados",
        releaseError
      )
    }
  }

  async processPendingBatch(limit: number = BATCH_SIZE): Promise<BatchCounters> {
    const claimed = await this.claimPendingBatch(limit)
    const counters: BatchCounters = { processed: 0, failed: 0, skipped: 0 }

    // Uma linha que estoura não pode levar junto o resto do lote: com limite de
    // 200, uma falha transitória prendia quase todas em `processing` até a
    // recuperação de 10 min.
    const unfinished = new Set(claimed.map((event) => event.id))

    try {
      for (const event of claimed) {
        try {
          await this.processClaimedEvent(event, counters)
          unfinished.delete(event.id)
        } catch (rowError) {
          counters.failed += 1
          console.error(
            `[EmailOrphanEventService] Falha inesperada no órfão ${event.id} (${event.resendEmailId})`,
            rowError
          )
          // Só sai da lista de pendências se a liberação individual funcionou;
          // se ela também falhou, a linha vai no `updateMany` do `finally`.
          if (await this.releaseAfterUnexpectedError(event, rowError)) {
            unfinished.delete(event.id)
          }
        }

        await sleep(MIN_INTERVAL_MS)
      }
    } finally {
      await this.releaseUnfinishedClaims([...unfinished])
    }

    return counters
  }
}

export const emailOrphanEventService = new EmailOrphanEventService()
