import { Output } from "@/lib/output";
import type { AsaasWebhookBody } from "@/app/api/webhooks/asaas/processAsaasWebhookEvent";
import {
  asaasWebhookEventRepository,
  type AsaasWebhookEventRepository,
  type AsaasWebhookEventClaimRow,
} from "@/app/api/infra/data/repositories/asaasWebhook/AsaasWebhookEventRepository";
import { publishWithRetry } from "@/lib/queues/publish-with-retry";
import { publishAsaasWebhookEvent } from "@/lib/queues/asaas-webhook-events";
import { buildOutboxRetryIdempotencyKey } from "@/lib/queues/outbox-retry-idempotency-key";

/**
 * Tamanho do lote por execução do cron (a cada 5 min). Reprocessar aqui virou
 * só um `publish` na fila (chamada de rede, sem transação Postgres) — bem
 * mais barato que o antigo `processAsaasWebhookEvent()` direto, então o lote
 * pode ser bem maior que os antigos 20/execução sem estourar
 * `maxDuration=60` do cron. Ajustável via env para reagir a picos de outbox
 * sem precisar de deploy (mesmo padrão de RetryResendWebhookFailuresUseCase).
 */
const DEFAULT_BATCH_SIZE = 1000;
const BATCH_SIZE = Math.max(
  1,
  Number(process.env.ASAAS_WEBHOOK_RETRY_BATCH_SIZE ?? DEFAULT_BATCH_SIZE)
);

/** Quantos `publish` concorrentes por vez, para não estourar o rate limit da Vercel Queues. */
const PUBLISH_CONCURRENCY = Math.max(
  1,
  Number(process.env.ASAAS_WEBHOOK_RETRY_CONCURRENCY ?? 25)
);

function formatProcessingError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 2000);
  return String(error).slice(0, 2000);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export class RetryAsaasWebhookFailuresUseCase {
  constructor(
    private readonly repository: AsaasWebhookEventRepository = asaasWebhookEventRepository
  ) {}

  private parsePayload(payload: AsaasWebhookEventClaimRow["payload"]): AsaasWebhookBody {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload as AsaasWebhookBody;
    }
    return JSON.parse(String(payload)) as AsaasWebhookBody;
  }

  private retryIdempotencyKey(row: AsaasWebhookEventClaimRow): string {
    return buildOutboxRetryIdempotencyKey({
      originalKey: row.id,
      outboxRowId: row.id,
      attemptCount: row.attemptCount,
    });
  }

  /**
   * Republica uma linha do outbox na fila `asaas-webhook-events` (mesmo
   * caminho do `after()` do webhook). Quem chama `processAsaasWebhookEvent`
   * de fato é só o consumer da fila (`markProcessed`/`markFailed` lá) — o
   * cron de retry deixou de fazer trabalho de Postgres no próprio isolate,
   * fechando para o caminho de retry o mesmo padrão que o PR2.2 já tinha
   * aplicado ao caminho feliz do webhook. `markProcessed` aqui sinaliza
   * "entregue à fila com sucesso", não "processado de fato" — se o consumer
   * falhar depois, ele mesmo chama `markFailed` e a linha volta a ser
   * elegível para retry no próximo ciclo (auto-corretivo).
   */
  private async retryOne(
    row: AsaasWebhookEventClaimRow
  ): Promise<"resolved" | "retried" | "failed"> {
    try {
      const body = this.parsePayload(row.payload);
      const publishResult = await publishWithRetry(() =>
        publishAsaasWebhookEvent(
          { eventId: row.id, body, account: row.account },
          { idempotencyKey: this.retryIdempotencyKey(row) },
        )
      );
      if (!publishResult.ok) {
        throw publishResult.error instanceof Error
          ? publishResult.error
          : new Error(formatProcessingError(publishResult.error));
      }
      await this.repository.markProcessed(row.id);
      return "resolved";
    } catch (error) {
      const nextAttemptCount = row.attemptCount + 1;
      const outcome = await this.repository.markRetryOrFailed(
        row.id,
        nextAttemptCount,
        formatProcessingError(error)
      );
      return outcome;
    }
  }

  async execute(): Promise<Output> {
    let claimedIds: string[] = [];

    try {
      const claimed = await this.repository.claimDue(BATCH_SIZE);
      claimedIds = claimed.map((row) => row.id);

      let resolved = 0;
      let retried = 0;
      let failed = 0;

      for (const batch of chunk(claimed, PUBLISH_CONCURRENCY)) {
        const outcomes = await Promise.all(batch.map((row) => this.retryOne(row)));
        for (const outcome of outcomes) {
          if (outcome === "resolved") resolved += 1;
          else if (outcome === "failed") failed += 1;
          else retried += 1;
        }
      }

      console.info("[RetryAsaasWebhookFailuresUseCase] Lote processado", {
        claimed: claimed.length,
        resolved,
        retried,
        failed,
      });

      return new Output(
        true,
        [
          `${resolved} evento(s) republicado(s) na fila, ${retried} reenfileirado(s) no outbox, ${failed} falha(s) definitiva(s)`,
        ],
        [],
        { claimed: claimed.length, resolved, retried, failed }
      );
    } catch (error) {
      console.error("[RetryAsaasWebhookFailuresUseCase][execute]", error);
      await this.repository.requeueIfProcessing(claimedIds).catch((requeueError) => {
        console.error(
          "[RetryAsaasWebhookFailuresUseCase] Falha ao reenfileirar lote:",
          requeueError
        );
      });
      return new Output(false, [], ["Erro ao reprocessar falhas do webhook Asaas"], null);
    }
  }
}

export const retryAsaasWebhookFailuresUseCase = new RetryAsaasWebhookFailuresUseCase();
