import { Output } from "@/lib/output";
import { resendWebhookUseCase } from "@/app/api/useCases/resendWebhook/ResendWebhookUseCase";
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes";
import {
  formatProcessingError,
  resendWebhookProcessingFailureRepository,
  type ResendWebhookProcessingFailureRepository,
} from "@/app/api/infra/data/repositories/resendWebhookProcessingFailure/ResendWebhookProcessingFailureRepository";
import type { ResendWebhookProcessingFailureClaimRow } from "@/app/api/infra/data/repositories/resendWebhookProcessingFailure/IResendWebhookProcessingFailureRepository";

const BATCH_SIZE = 20;

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
          const event = this.parsePayload(row.payload);
          const result = await resendWebhookUseCase.handle({ event, svixId: row.svixId });
          if (!result.isValid) {
            throw new Error(result.errorMessages.join("; ") || "Falha ao reprocessar webhook Resend");
          }
          await this.repository.markResolved(row.id);
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

      console.info("[RetryResendWebhookFailuresUseCase] Lote processado", {
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
