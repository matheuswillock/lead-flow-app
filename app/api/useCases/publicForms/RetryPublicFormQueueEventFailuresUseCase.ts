import { Output } from "@/lib/output"
import {
  publicFormQueueEventFailureRepository,
  formatProcessingError,
} from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/PublicFormQueueEventFailureRepository"
import type {
  IPublicFormQueueEventFailureRepository,
  PublicFormQueueEventFailureClaimRow,
} from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/IPublicFormQueueEventFailureRepository"
import {
  publicFormsUseCase,
  PublicFormsUseCase,
} from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import {
  publicFormSubmissionUseCase,
  PublicFormSubmissionUseCase,
  type PublicFormSubmissionBackgroundJob,
} from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types"
import type { PublicFormMetricQueuePayload } from "@/lib/queues/public-form-metric-events"

const BATCH_SIZE = 20

/**
 * PR2.3 — cron de retry compartilhado entre os dois pontos de fila de
 * formulários públicos (métricas + submissão), espelhando
 * RetryAsaasWebhookFailuresUseCase/RetryResendWebhookFailuresUseCase.
 * `row.kind` decide qual use case de negócio reprocessa o payload.
 */
export class RetryPublicFormQueueEventFailuresUseCase {
  constructor(
    private readonly repository: IPublicFormQueueEventFailureRepository = publicFormQueueEventFailureRepository,
    private readonly metricsUseCase: Pick<PublicFormsUseCase, "persistQueuedMetric"> = publicFormsUseCase,
    private readonly submissionUseCase: Pick<
      PublicFormSubmissionUseCase,
      "processInBackground"
    > = publicFormSubmissionUseCase,
  ) {}

  private parseJsonPayload<T>(payload: PublicFormQueueEventFailureClaimRow["payload"]): T {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload as unknown as T
    }
    return JSON.parse(String(payload)) as T
  }

  private async reprocess(row: PublicFormQueueEventFailureClaimRow): Promise<void> {
    if (row.kind === "metric") {
      const payload = this.parseJsonPayload<PublicFormMetricQueuePayload>(row.payload)
      await this.metricsUseCase.persistQueuedMetric(payload.publicId, {
        visitorSessionId: payload.visitorSessionId,
        eventType: payload.eventType,
        questionId: payload.questionId ?? undefined,
        eventKey: payload.eventKey,
        origin: payload.origin ?? {},
      } as PublicFormMetricEventInput)
      return
    }

    const job = this.parseJsonPayload<PublicFormSubmissionBackgroundJob>(row.payload)
    await this.submissionUseCase.processInBackground(job)
  }

  async execute(): Promise<Output> {
    let claimedIds: string[] = []

    try {
      const claimed = await this.repository.claimDue(BATCH_SIZE)
      claimedIds = claimed.map((row) => row.id)

      let resolved = 0
      let retried = 0
      let failed = 0

      for (const row of claimed) {
        try {
          await this.reprocess(row)
          await this.repository.markResolved(row.id)
          resolved += 1
        } catch (error) {
          const nextAttemptCount = row.attemptCount + 1
          const outcome = await this.repository.markRetryOrFailed(
            row.id,
            nextAttemptCount,
            formatProcessingError(error),
          )
          if (outcome === "failed") {
            failed += 1
          } else {
            retried += 1
          }
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
          `${resolved} evento(s) resolvido(s), ${retried} reenfileirado(s), ${failed} falha(s) definitiva(s)`,
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
