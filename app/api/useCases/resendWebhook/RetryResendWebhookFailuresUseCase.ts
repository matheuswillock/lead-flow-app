import { Output } from "@/lib/output";
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes";
import {
  formatProcessingError,
  resendWebhookProcessingFailureRepository,
  type ResendWebhookProcessingFailureRepository,
} from "@/app/api/infra/data/repositories/resendWebhookProcessingFailure/ResendWebhookProcessingFailureRepository";
import type { ResendWebhookProcessingFailureClaimRow } from "@/app/api/infra/data/repositories/resendWebhookProcessingFailure/IResendWebhookProcessingFailureRepository";
import { publishWithRetry } from "@/lib/queues/publish-with-retry";
import { publishResendWebhookEmailLogEvent } from "@/lib/queues/resend-webhook-emaillog-events";

/**
 * Tamanho do lote por execução do cron (a cada 2 min). Reprocessar aqui virou
 * só um `publish` na fila (chamada de rede, sem transação Postgres) — bem
 * mais barato que o antigo `resendWebhookUseCase.handle()` direto, então o
 * lote pode ser bem maior que os antigos 20/execução (240/h) sem estourar
 * `maxDuration=60` do cron. Ajustável via env para reagir a picos de outbox
 * sem precisar de deploy.
 *
 * O `claimDue` do repositório agora reserva o lote com uma única query
 * atômica (`FOR UPDATE SKIP LOCKED`) em vez de N `updateMany` sequenciais,
 * então o teto prático de `maxDuration=60` passou a ser dominado pela fase
 * de publish (chunk de `PUBLISH_CONCURRENCY`), não pelo claim — por isso o
 * valor padrão pôde dobrar de 1000 para 2000 sem risco de timeout.
 */
const DEFAULT_BATCH_SIZE = 2000;
const BATCH_SIZE = Math.max(
  1,
  Number(process.env.RESEND_WEBHOOK_RETRY_BATCH_SIZE ?? DEFAULT_BATCH_SIZE)
);

/** Quantos `publish` concorrentes por vez, para não estourar o rate limit da Vercel Queues. */
const PUBLISH_CONCURRENCY = Math.max(
  1,
  Number(process.env.RESEND_WEBHOOK_RETRY_CONCURRENCY ?? 25)
);

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export class RetryResendWebhookFailuresUseCase {
  constructor(
    private readonly repository: ResendWebhookProcessingFailureRepository = resendWebhookProcessingFailureRepository
  ) {}

  private parsePayload(payload: ResendWebhookProcessingFailureClaimRow["payload"]): ResendWebhookPayload {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload as ResendWebhookPayload;
    }
    return JSON.parse(String(payload)) as ResendWebhookPayload;
  }

  /**
   * Republica uma linha do outbox na fila `resend-webhook-emaillog-events`
   * (mesmo caminho do `after()` do webhook). O processamento de negócio
   * (`resendWebhookUseCase.handle()`) fica só no consumer da fila — o cron
   * de retry deixou de fazer trabalho de Postgres no próprio isolate,
   * fechando o mesmo padrão do PR2.1 também para o caminho de retry.
   */
  private async retryOne(
    row: ResendWebhookProcessingFailureClaimRow
  ): Promise<"resolved" | "retried" | "failed"> {
    try {
      const event = this.parsePayload(row.payload);
      const publishResult = await publishWithRetry(() =>
        publishResendWebhookEmailLogEvent({ event, svixId: row.svixId })
      );
      if (!publishResult.ok) {
        throw publishResult.error instanceof Error
          ? publishResult.error
          : new Error(formatProcessingError(publishResult.error));
      }
      await this.repository.markResolved(row.id);
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

      console.info("[RetryResendWebhookFailuresUseCase] Lote processado", {
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
      console.error("[RetryResendWebhookFailuresUseCase][execute]", error);
      await this.repository.requeueIfProcessing(claimedIds).catch((requeueError) => {
        console.error(
          "[RetryResendWebhookFailuresUseCase] Falha ao reenfileirar lote:",
          requeueError
        );
      });
      return new Output(false, [], ["Erro ao reprocessar falhas do webhook Resend"], null);
    }
  }
}

export const retryResendWebhookFailuresUseCase = new RetryResendWebhookFailuresUseCase();
