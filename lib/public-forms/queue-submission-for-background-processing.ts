import type { Prisma } from "@prisma/client"
import { publishWithRetry } from "@/lib/queues/publish-with-retry"
import { publishPublicFormSubmissionEvent } from "@/lib/queues/public-form-submission-events"
import {
  formatProcessingError,
  publicFormQueueEventFailureRepository,
} from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/PublicFormQueueEventFailureRepository"
import type { PublicFormSubmissionBackgroundJob } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"

export type QueueSubmissionForBackgroundProcessingDeps = {
  markAccepted?: (submissionId: string) => Promise<void>
  markDeferred?: (submissionId: string, errorMessage: string) => Promise<void>
}

/**
 * PR2.3 — extraído para módulo próprio (em vez de método inline no
 * UseCase) porque `PublicFormSubmissionUseCase.ts` carrega uma cadeia de
 * dependências pesada (repositórios/serviços de lead, agenda, Google) que
 * não pode ser importada de forma isolada em teste; esta função só depende
 * da fila e do outbox, então é testável sem essa cadeia.
 *
 * Publica o job na fila `public-form-submission-events` com retry curto
 * (`publish-with-retry`, 3 tentativas). Se as 3 esgotarem, grava no outbox
 * compartilhado (`PublicFormQueueEventFailure`, kind=submission) — nunca
 * lança, então o `after()` que chama isso nunca falha silenciosamente.
 */
export async function queueSubmissionForBackgroundProcessing(
  job: PublicFormSubmissionBackgroundJob,
  deps: QueueSubmissionForBackgroundProcessingDeps = {},
): Promise<{ accepted: boolean }> {
  const markAccepted = deps.markAccepted ?? ((submissionId) => publicFormsRepository.markSubmissionDispatchAccepted(submissionId))
  const markDeferred = deps.markDeferred ?? ((submissionId, errorMessage) => publicFormsRepository.markSubmissionDispatchDeferred(submissionId, errorMessage))
  const publishResult = await publishWithRetry(() => publishPublicFormSubmissionEvent(job))
  if (publishResult.ok) {
    await markAccepted(job.submissionId)
    return { accepted: true }
  }

  console.error("[queueSubmissionForBackgroundProcessing][publish-exhausted]", {
    submissionId: job.submissionId,
    requestKey: job.requestKey,
    attempts: publishResult.attempts,
    error: publishResult.error,
  })
  try {
    await publicFormQueueEventFailureRepository.upsertFromProcessingFailure({
      kind: "submission",
      idempotencyKey: job.requestKey,
      payload: job as unknown as Prisma.InputJsonValue,
      lastError: formatProcessingError(publishResult.error),
      failureReason: "queue_publish_failed",
      eventId: job.eventId ?? null,
      schemaVersion: 1,
      topic: "public-form-submission-events",
      failureStage: "publisher_outbox",
    })
    await markAccepted(job.submissionId)
    return { accepted: true }
  } catch (outboxError) {
    console.error("[queueSubmissionForBackgroundProcessing][outbox]", outboxError)
    await markDeferred(
      job.submissionId,
      formatProcessingError(outboxError),
    )
    return { accepted: false }
  }
}
