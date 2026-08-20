import { Output } from "@/lib/output"
import {
  queueProcessingFailureRepository,
} from "@/app/api/infra/data/repositories/queueProcessingFailure/QueueProcessingFailureRepository"
import type {
  IQueueProcessingFailureRepository,
  QueueProcessingFailureClaimRow,
} from "@/app/api/infra/data/repositories/queueProcessingFailure/IQueueProcessingFailureRepository"
import { formatQueueProcessingError } from "@/lib/queues/queue-processing-failure"
import {
  QUEUE_PROCESSING_FAILURE_DEDICATED_RETRY_TOPICS,
  QUEUE_PROCESSING_FAILURE_REPUBLISHERS,
  type QueueProcessingFailureRepublisher,
} from "@/lib/queues/queue-processing-failure-republish"

const DEFAULT_BATCH_SIZE = 1000
const BATCH_SIZE = Math.max(
  1,
  Number(process.env.QUEUE_PROCESSING_FAILURE_RETRY_BATCH_SIZE ?? DEFAULT_BATCH_SIZE),
)

const PUBLISH_CONCURRENCY = Math.max(
  1,
  Number(process.env.QUEUE_PROCESSING_FAILURE_RETRY_CONCURRENCY ?? 25),
)

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export class RetryQueueProcessingFailuresUseCase {
  constructor(
    private readonly repository: IQueueProcessingFailureRepository = queueProcessingFailureRepository,
    private readonly republishers: Record<string, QueueProcessingFailureRepublisher> = QUEUE_PROCESSING_FAILURE_REPUBLISHERS,
    private readonly dedicatedRetryTopics: ReadonlySet<string> = QUEUE_PROCESSING_FAILURE_DEDICATED_RETRY_TOPICS,
  ) {}

  /**
   * A Vercel Queues deduplica `send()` pela `idempotencyKey` — reusar a chave
   * original (já acked no consumer) seria no-op. Cada republish do outbox usa
   * chave própria; a dedupe de negócio continua no Postgres.
   */
  private retryIdempotencyKey(row: QueueProcessingFailureClaimRow): string {
    return `${row.idempotencyKey}:outbox-retry:${row.id}:${row.attemptCount}`
  }

  private async retryOne(
    row: QueueProcessingFailureClaimRow,
  ): Promise<"resolved" | "retried" | "failed"> {
    try {
      if (this.dedicatedRetryTopics.has(row.topic)) {
        await this.repository.markResolved(row.id)
        return "resolved"
      }

      const republish = this.republishers[row.topic]
      if (!republish) {
        return this.repository.markRetryOrFailed(
          row.id,
          row.attemptCount + 1,
          `Tópico sem mapa de republicação: ${row.topic}`,
        )
      }

      await republish(row.payload, this.retryIdempotencyKey(row))
      await this.repository.markResolved(row.id)
      return "resolved"
    } catch (error) {
      const nextAttemptCount = row.attemptCount + 1
      return this.repository.markRetryOrFailed(
        row.id,
        nextAttemptCount,
        formatQueueProcessingError(error),
      )
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

      console.info("[RetryQueueProcessingFailuresUseCase] Lote processado", {
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
      console.error("[RetryQueueProcessingFailuresUseCase][execute]", error)
      await this.repository.requeueIfProcessing(claimedIds).catch((requeueError) => {
        console.error(
          "[RetryQueueProcessingFailuresUseCase] Falha ao reenfileirar lote:",
          requeueError,
        )
      })
      return new Output(
        false,
        [],
        ["Erro ao reprocessar falhas de processamento de fila"],
        null,
      )
    }
  }
}

export const retryQueueProcessingFailuresUseCase = new RetryQueueProcessingFailuresUseCase()
