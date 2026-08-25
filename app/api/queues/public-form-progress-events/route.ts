import {
  publicFormProgressUseCase,
  PublicFormProgressUseCase,
} from "@/app/api/useCases/publicForms/PublicFormProgressUseCase"
import {
  handlePublicFormProgressEventsCallback,
  PUBLIC_FORM_PROGRESS_EVENTS_TOPIC,
  type PublicFormProgressQueuePayload,
} from "@/lib/queues/public-form-progress-events"
import {
  ackAfterMaxDeliveries,
  deadLetterInvalidPayload,
  type AckAfterMaxDeliveriesFn,
  type DeadLetterInvalidPayloadFn,
} from "@/lib/queues/queue-processing-failure"

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency em vercel.json).
 * Roda o `execute` atual do progresso (Prisma + lead sync) fora do isolate HTTP.
 * Acima de N entregas, o helper de dead-letter persiste em `QueueProcessingFailure` e acka.
 */
export async function processPublicFormProgressEventMessage(
  message: PublicFormProgressQueuePayload,
  metadata: QueueMessageMetadata,
  useCase: Pick<PublicFormProgressUseCase, "execute"> = publicFormProgressUseCase,
  ackDeadLetter: AckAfterMaxDeliveriesFn = ackAfterMaxDeliveries,
  deadLetter: DeadLetterInvalidPayloadFn = deadLetterInvalidPayload,
): Promise<void> {
  console.info("[PublicFormProgressEventsQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    publicId: message?.publicId,
    visitorSessionId: message?.visitorSessionId,
    idempotencyKey: message?.idempotencyKey,
  })

  if (!message?.publicId || !message?.visitorSessionId || !message?.idempotencyKey) {
    console.error("[PublicFormProgressEventsQueueRoute][POST] invalid payload, dead-letter e ack", {
      messageId: metadata.messageId,
      publicId: message?.publicId,
      visitorSessionId: message?.visitorSessionId,
      idempotencyKey: message?.idempotencyKey,
      eventId: message?.eventId,
    })
    // SPEC 40 E5, todo 11: era `return` mudo — a mensagem sumia sem deixar
    // linha em lugar nenhum. Vai direto para a dead-letter (retentar payload
    // malformado nunca conserta) e só então acka.
    await deadLetter({
      topic: PUBLIC_FORM_PROGRESS_EVENTS_TOPIC,
      idempotencyKey: message?.idempotencyKey ?? `invalid-payload:${metadata.messageId}`,
      payload: message ?? null,
      reason: "Payload de progresso sem publicId, visitorSessionId ou idempotencyKey",
    })
    return
  }

  try {
    const output = await useCase.execute(message.publicId, {
      visitorSessionId: message.visitorSessionId,
      answers: message.answers ?? [],
      origin: message.origin ?? {},
      lastQuestionId: message.lastQuestionId,
      schemaVersion: message.schemaVersion,
      eventId: message.eventId,
      occurredAt: message.occurredAt,
      trigger: message.trigger,
    })
    if (!output.isValid) {
      console.info("[PublicFormProgressEventsQueueRoute][POST] form unavailable, acking", {
        messageId: metadata.messageId,
        publicId: message.publicId,
        idempotencyKey: message.idempotencyKey,
      })
      return
    }
    console.info("[PublicFormProgressEventsQueueRoute][POST] progress persisted", {
      messageId: metadata.messageId,
      publicId: message.publicId,
      visitorSessionId: message.visitorSessionId,
      idempotencyKey: message.idempotencyKey,
      submissionId:
        output.result && typeof output.result === "object" && "submissionId" in output.result
          ? output.result.submissionId
          : null,
    })
  } catch (error) {
    console.error("[PublicFormProgressEventsQueueRoute][POST] execute failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      publicId: message.publicId,
      idempotencyKey: message.idempotencyKey,
      error,
    })
    const acked = await ackDeadLetter({
      deliveryCount: metadata.deliveryCount,
      topic: PUBLIC_FORM_PROGRESS_EVENTS_TOPIC,
      idempotencyKey: message.idempotencyKey,
      payload: message,
      lastError: error,
    })
    if (acked) {
      console.error(
        "[PublicFormProgressEventsQueueRoute][POST] deliveryCount excedeu o limite, movido para outbox, acking",
        {
          messageId: metadata.messageId,
          deliveryCount: metadata.deliveryCount,
          idempotencyKey: message.idempotencyKey,
        },
      )
      return
    }
    throw error
  }
}

export const POST = handlePublicFormProgressEventsCallback(
  (message: PublicFormProgressQueuePayload, metadata: QueueMessageMetadata) =>
    processPublicFormProgressEventMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  },
)
