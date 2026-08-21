import type { Prisma } from "@prisma/client"
import { publishWithRetry } from "@/lib/queues/publish-with-retry"
import {
  publishPublicFormProgressEvent,
  PUBLIC_FORM_PROGRESS_EVENTS_TOPIC,
  type PublicFormProgressQueuePayload,
} from "@/lib/queues/public-form-progress-events"
import { formatQueueProcessingError } from "@/lib/queues/queue-processing-failure"
import { queueProcessingFailureRepository } from "@/app/api/infra/data/repositories/queueProcessingFailure/QueueProcessingFailureRepository"
import type { IQueueProcessingFailureRepository } from "@/app/api/infra/data/repositories/queueProcessingFailure/IQueueProcessingFailureRepository"

export type QueueProgressForBackgroundProcessingDeps = {
  publish?: (
    payload: PublicFormProgressQueuePayload,
    options?: { idempotencyKey?: string },
  ) => Promise<{ messageId: string | null }>
  persistOutbox?: IQueueProcessingFailureRepository["upsertFromProcessingFailure"]
}

/**
 * Publica o blur na fila `public-form-progress-events` com retry curto.
 * Se as tentativas esgotarem, grava no outbox `QueueProcessingFailure`
 * (mesmo cron de dead-letter do PR1q) — nunca lança, para o POST /progress
 * responder 202 sem Prisma no isolate.
 */
export async function queueProgressForBackgroundProcessing(
  payload: PublicFormProgressQueuePayload,
  deps: QueueProgressForBackgroundProcessingDeps = {},
): Promise<void> {
  const publish = deps.publish ?? publishPublicFormProgressEvent
  const persistOutbox =
    deps.persistOutbox ??
    ((input) => queueProcessingFailureRepository.upsertFromProcessingFailure(input))

  const publishResult = await publishWithRetry(() =>
    publish(payload, { idempotencyKey: payload.idempotencyKey }),
  )
  if (publishResult.ok) return

  console.error("[queueProgressForBackgroundProcessing][publish-exhausted]", {
    publicId: payload.publicId,
    visitorSessionId: payload.visitorSessionId,
    idempotencyKey: payload.idempotencyKey,
    attempts: publishResult.attempts,
    error: publishResult.error,
  })

  try {
    await persistOutbox({
      topic: PUBLIC_FORM_PROGRESS_EVENTS_TOPIC,
      idempotencyKey: payload.idempotencyKey,
      payload: payload as unknown as Prisma.InputJsonValue,
      lastError: formatQueueProcessingError(publishResult.error),
    })
  } catch (outboxError) {
    console.error("[queueProgressForBackgroundProcessing][outbox]", outboxError)
  }
}
