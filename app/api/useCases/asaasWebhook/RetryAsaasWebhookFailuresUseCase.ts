import { Output } from "@/lib/output";
import {
  processAsaasWebhookEvent,
  type AsaasWebhookBody,
} from "@/app/api/webhooks/asaas/processAsaasWebhookEvent";
import {
  asaasWebhookEventRepository,
  type AsaasWebhookEventRepository,
  type AsaasWebhookEventClaimRow,
} from "@/app/api/infra/data/repositories/asaasWebhook/AsaasWebhookEventRepository";

const BATCH_SIZE = 20;

function formatProcessingError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 2000);
  return String(error).slice(0, 2000);
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

  async execute(): Promise<Output> {
    let claimedIds: string[] = [];

    try {
      const claimed = await this.repository.claimDue(BATCH_SIZE);
      claimedIds = claimed.map((row) => row.id);

      let resolved = 0;
      let retried = 0;
      let failed = 0;

      for (const row of claimed) {
        try {
          const body = this.parsePayload(row.payload);
          await processAsaasWebhookEvent(body);
          await this.repository.markProcessed(row.id);
          resolved += 1;
        } catch (error) {
          const nextAttemptCount = row.attemptCount + 1;
          const outcome = await this.repository.markRetryOrFailed(
            row.id,
            nextAttemptCount,
            formatProcessingError(error)
          );
          if (outcome === "failed") {
            failed += 1;
          } else {
            retried += 1;
          }
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
          `${resolved} evento(s) resolvido(s), ${retried} reenfileirado(s), ${failed} falha(s) definitiva(s)`,
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
