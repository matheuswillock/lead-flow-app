import { publicFormsUseCase, PublicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types"
import {
  handlePublicFormMetricEventsCallback,
  PUBLIC_FORM_METRIC_EVENTS_TOPIC,
  type PublicFormMetricQueuePayload,
} from "@/lib/queues/public-form-metric-events"
import {
  ackAfterMaxDeliveriesWithOutcome,
  type AckAfterMaxDeliveriesWithOutcomeFn,
} from "@/lib/queues/queue-processing-failure"
import {
  deadLetterInvalidPayload,
  describeMissingRequiredFields,
  listMissingRequiredFields,
} from "@/lib/queues/queue-invalid-payload"

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency: 1).
 * Persiste `PublicFormMetricEvent` de forma idempotente via `eventKey` único.
 * Entrega at-least-once: duplicatas colapsam no upsert do repositório.
 * Acima de N entregas, o helper de dead-letter persiste em `QueueProcessingFailure` e acka.
 */
export async function processPublicFormMetricQueueMessage(
  message: PublicFormMetricQueuePayload,
  metadata: QueueMessageMetadata,
  useCase: Pick<PublicFormsUseCase, "persistQueuedMetric"> = publicFormsUseCase,
  ackDeadLetter: AckAfterMaxDeliveriesWithOutcomeFn = ackAfterMaxDeliveriesWithOutcome,
): Promise<void> {
  console.info("[PublicFormMetricEventsQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    eventType: message?.eventType,
    eventKey: message?.eventKey,
    publicId: message?.publicId,
  })

  const missingFields = listMissingRequiredFields({
    publicId: message?.publicId,
    eventKey: message?.eventKey,
    visitorSessionId: message?.visitorSessionId,
    eventType: message?.eventType,
  })
  if (missingFields.length > 0) {
    console.error("[PublicFormMetricEventsQueueRoute][POST] invalid payload, dead-letter e ack", {
      messageId: metadata.messageId,
      publicId: message?.publicId,
      eventId: message?.eventId ?? null,
      eventKey: message?.eventKey,
      eventType: message?.eventType,
      missingFields,
    })
    await deadLetterInvalidPayload(
      {
        topic: PUBLIC_FORM_METRIC_EVENTS_TOPIC,
        idempotencyKeyCandidate: message?.eventKey,
        messageId: metadata.messageId,
        payload: message,
        detail: describeMissingRequiredFields(missingFields),
      },
      ackDeadLetter,
    )
    return
  }

  const input: PublicFormMetricEventInput = {
    visitorSessionId: message.visitorSessionId,
    schemaVersion: message.schemaVersion,
    eventId: message.eventId ?? undefined,
    occurredAt: message.occurredAt,
    eventType: message.eventType as PublicFormMetricEventInput["eventType"],
    questionId: message.questionId ?? undefined,
    eventKey: message.eventKey,
    origin: message.origin ?? {},
    answerMappingKey: message.answerMappingKey ?? null,
    answerValue: message.answerValue ?? null,
    pageId: message.pageId ?? null,
    pageIndex: message.pageIndex ?? null,
    validationCodes: message.validationCodes,
    createCrmLead: message.createCrmLead !== false,
  }

  try {
    const accepted = await useCase.persistQueuedMetric(message.publicId, input)
    if (!accepted) {
      console.info("[PublicFormMetricEventsQueueRoute][POST] form unavailable, acking", {
        messageId: metadata.messageId,
        publicId: message.publicId,
        eventKey: message.eventKey,
      })
      return
    }
    console.info("[PublicFormMetricEventsQueueRoute][POST] metric persisted", {
      messageId: metadata.messageId,
      eventKey: message.eventKey,
      eventType: message.eventType,
      visitorSessionId: message.visitorSessionId,
      questionId: message.questionId ?? null,
    })
  } catch (error) {
    console.error("[PublicFormMetricEventsQueueRoute][POST] persist failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      eventKey: message.eventKey,
      error,
    })

    let persistedToOutbox = false
    const acked = await ackDeadLetter(
      {
        deliveryCount: metadata.deliveryCount,
        topic: PUBLIC_FORM_METRIC_EVENTS_TOPIC,
        idempotencyKey: message.eventKey,
        payload: message,
        lastError: error,
      },
      (outcome) => {
        persistedToOutbox = outcome
      },
    )
    if (acked) {
      console.error(
        persistedToOutbox
          ? "[PublicFormMetricEventsQueueRoute][POST] deliveryCount excedeu o limite, movido para outbox, acking"
          : "[PublicFormMetricEventsQueueRoute][POST] deliveryCount excedeu o limite rígido sem outbox, payload só no log, acking",
        {
          messageId: metadata.messageId,
          deliveryCount: metadata.deliveryCount,
          eventKey: message.eventKey,
          persistedToOutbox,
        },
      )
      return
    }

    throw error
  }
}

export const POST = handlePublicFormMetricEventsCallback(
  processPublicFormMetricQueueMessage,
  {
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  },
)
