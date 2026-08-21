import { Output } from "@/lib/output"
import {
  publicFormQueueEventFailureRepository,
  formatProcessingError,
} from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/PublicFormQueueEventFailureRepository"
import type {
  IPublicFormQueueEventFailureRepository,
  PublicFormQueueEventFailureClaimRow,
} from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/IPublicFormQueueEventFailureRepository"
import { publishWithRetry } from "@/lib/queues/publish-with-retry"
import {
  publishPublicFormMetricEvent,
  type PublicFormMetricQueuePayload,
} from "@/lib/queues/public-form-metric-events"
import { publishPublicFormSubmissionEvent } from "@/lib/queues/public-form-submission-events"
import {
  publishPublicFormProgressEvent,
  type PublicFormProgressQueuePayload,
} from "@/lib/queues/public-form-progress-events"
import type { PublicFormSubmissionBackgroundJob } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"

/**
 * Tamanho do lote por execução do cron (a cada 5 min). Reprocessar aqui virou
 * só um `publish` na fila (chamada de rede, sem transação Postgres/lead
 * matching), então o lote pode ser bem maior que um processamento direto sem
 * estourar `maxDuration` do cron. Ajustável via env (mesmo padrão de
 * RetryResendWebhookFailuresUseCase / RetryAsaasWebhookFailuresUseCase).
 */
const DEFAULT_BATCH_SIZE = 1000
const BATCH_SIZE = Math.max(
  1,
  Number(process.env.PUBLIC_FORM_QUEUE_EVENT_RETRY_BATCH_SIZE ?? DEFAULT_BATCH_SIZE),
)

/** Quantos `publish` concorrentes por vez, para não estourar o rate limit da Vercel Queues. */
const PUBLISH_CONCURRENCY = Math.max(
  1,
  Number(process.env.PUBLIC_FORM_QUEUE_EVENT_RETRY_CONCURRENCY ?? 25),
)

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * PR2.3 + follow-up: cron de retry compartilhado entre os dois pontos de fila
 * de formulários públicos (métricas + submissão), espelhando
 * RetryAsaasWebhookFailuresUseCase/RetryResendWebhookFailuresUseCase.
 * `row.kind` decide em qual fila republicar o payload — o processamento de
 * negócio (`persistQueuedMetric`/`processInBackground`) continua só nos
 * consumers das filas, nunca direto no isolate do cron.
 */
export class RetryPublicFormQueueEventFailuresUseCase {
  constructor(
    private readonly repository: IPublicFormQueueEventFailureRepository = publicFormQueueEventFailureRepository,
  ) {}

  private parseJsonPayload<T>(payload: PublicFormQueueEventFailureClaimRow["payload"]): T {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload as unknown as T
    }
    return JSON.parse(String(payload)) as T
  }

  /**
   * A Vercel Queues deduplica `send()` pela `idempotencyKey` — reusar a
   * mesma `eventKey`/`requestKey` da publicação original (já entregue e
   * eventualmente acked pelo consumer, inclusive em `delivery_count_exceeded`)
   * arriscaria um no-op silencioso: o `send()` "sucede" sem realmente
   * enfileirar uma mensagem nova, o outbox marca `resolved`, e o evento nunca
   * é reprocessado. Cada tentativa de republish a partir do outbox usa uma
   * idempotencyKey própria (linha + tentativa) para garantir que a Vercel
   * Queues sempre trate como uma mensagem nova; a dedupe de negócio continua
   * garantida pela constraint única em `eventKey`/`requestKey` no Postgres.
   */
  private retryIdempotencyKey(row: PublicFormQueueEventFailureClaimRow): string {
    return `${row.idempotencyKey}:outbox-retry:${row.id}:${row.attemptCount}`
  }

  private async republish(row: PublicFormQueueEventFailureClaimRow): Promise<void> {
    const idempotencyKey = this.retryIdempotencyKey(row)

    if (row.kind === "metric") {
      const payload = this.parseJsonPayload<PublicFormMetricQueuePayload>(row.payload)
      const result = await publishWithRetry(() =>
        publishPublicFormMetricEvent(payload, { idempotencyKey }),
      )
      if (!result.ok) {
        throw result.error instanceof Error ? result.error : new Error(formatProcessingError(result.error))
      }
      return
    }

    if (row.kind === "progress") {
      const payload = this.parseJsonPayload<PublicFormProgressQueuePayload>(row.payload)
      const result = await publishWithRetry(() =>
        publishPublicFormProgressEvent(payload, { idempotencyKey }),
      )
      if (!result.ok) {
        throw result.error instanceof Error ? result.error : new Error(formatProcessingError(result.error))
      }
      return
    }

    const job = this.parseJsonPayload<PublicFormSubmissionBackgroundJob>(row.payload)
    const result = await publishWithRetry(() =>
      publishPublicFormSubmissionEvent(job, { idempotencyKey }),
    )
    if (!result.ok) {
      throw result.error instanceof Error ? result.error : new Error(formatProcessingError(result.error))
    }
  }

  private async retryOne(
    row: PublicFormQueueEventFailureClaimRow,
  ): Promise<"resolved" | "retried" | "failed"> {
    try {
      await this.republish(row)
      await this.repository.markResolved(row.id)
      return "resolved"
    } catch (error) {
      const nextAttemptCount = row.attemptCount + 1
      return this.repository.markRetryOrFailed(row.id, nextAttemptCount, formatProcessingError(error))
    }
  }

  async execute(): Promise<Output> {
    let claimedIds: string[] = []

    try {
      const claimed = await this.repository.claimDue(BATCH_SIZE)
      claimedIds = claimed.map((row) => row.id)

      let resolved = 0
      let retried = 0
      let failed = 0

      for (const batch of chunk(claimed, PUBLISH_CONCURRENCY)) {
        const outcomes = await Promise.all(batch.map((row) => this.retryOne(row)))
        for (const outcome of outcomes) {
          if (outcome === "resolved") resolved += 1
          else if (outcome === "failed") failed += 1
          else retried += 1
        }
      }

      console.info("[RetryPublicFormQueueEventFailuresUseCase] Lote processado", {
        claimed: claimed.length,
        resolved,
        retried,
        failed,
      })

      return new Output(
        true,
        [
          `${resolved} evento(s) republicado(s) na fila, ${retried} reenfileirado(s) no outbox, ${failed} falha(s) definitiva(s)`,
        ],
        [],
        { claimed: claimed.length, resolved, retried, failed },
      )
    } catch (error) {
      console.error("[RetryPublicFormQueueEventFailuresUseCase][execute]", error)
      await this.repository.requeueIfProcessing(claimedIds).catch((requeueError) => {
        console.error(
          "[RetryPublicFormQueueEventFailuresUseCase] Falha ao reenfileirar lote:",
          requeueError,
        )
      })
      return new Output(
        false,
        [],
        ["Erro ao reprocessar falhas de fila de formulários públicos"],
        null,
      )
    }
  }
}

export const retryPublicFormQueueEventFailuresUseCase =
  new RetryPublicFormQueueEventFailuresUseCase()
