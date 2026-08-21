import { publishWithRetry } from "@/lib/queues/publish-with-retry"
import {
  publishPublicFormProgressEvent,
  PUBLIC_FORM_PROGRESS_EVENTS_TOPIC,
  type PublicFormProgressQueuePayload,
} from "@/lib/queues/public-form-progress-events"
import {
  formatProcessingError,
  publicFormQueueEventFailureRepository,
} from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/PublicFormQueueEventFailureRepository"
import type { IPublicFormQueueEventFailureRepository } from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/IPublicFormQueueEventFailureRepository"

export type QueueProgressForBackgroundProcessingDeps = {
  publish?: (
    payload: PublicFormProgressQueuePayload,
    options?: { idempotencyKey?: string },
  ) => Promise<{ messageId: string | null }>
  persistOutbox?: IPublicFormQueueEventFailureRepository["upsertFromProcessingFailure"]
}

/**
 * Publica o blur na fila `public-form-progress-events` com retry curto.
 * Se as tentativas esgotarem, grava no outbox próprio de formulários. O
 * endpoint confirma 202 somente quando a fila ou esse outbox aceitou o fato.
 */
export async function queueProgressForBackgroundProcessing(
  payload: PublicFormProgressQueuePayload,
  deps: QueueProgressForBackgroundProcessingDeps = {},
): Promise<{ accepted: boolean }> {
  const publish = deps.publish ?? publishPublicFormProgressEvent
  const persistOutbox =
    deps.persistOutbox ??
    ((input) => publicFormQueueEventFailureRepository.upsertFromProcessingFailure(input))

  const publishResult = await publishWithRetry(() =>
    publish(payload, { idempotencyKey: payload.idempotencyKey }),
  )
  if (publishResult.ok) return { accepted: true }

  console.error("[queueProgressForBackgroundProcessing][publish-exhausted]", {
    publicId: payload.publicId,
    visitorSessionId: payload.visitorSessionId,
    idempotencyKey: payload.idempotencyKey,
    attempts: publishResult.attempts,
    error: publishResult.error,
  })

  try {
    await persistOutbox({
      kind: "progress",
      topic: PUBLIC_FORM_PROGRESS_EVENTS_TOPIC,
      idempotencyKey: payload.idempotencyKey,
      payload: payload as unknown as Prisma.InputJsonValue,
      lastError: formatProcessingError(publishResult.error),
      failureReason: "queue_publish_failed",
      eventId: payload.eventId,
      schemaVersion: payload.schemaVersion,
      failureStage: "publisher_outbox",
    })
    return { accepted: true }
  } catch (outboxError) {
    console.error("[queueProgressForBackgroundProcessing][outbox]", outboxError)
    return { accepted: false }
  }
}
import type { Prisma } from "@prisma/client"
