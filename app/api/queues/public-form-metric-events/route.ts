import { publicFormsUseCase, PublicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types"
import {
  handlePublicFormMetricEventsCallback,
  PUBLIC_FORM_METRIC_EVENTS_TOPIC,
  type PublicFormMetricQueuePayload,
} from "@/lib/queues/public-form-metric-events"
import {
  ackAfterMaxDeliveries,
  type AckAfterMaxDeliveriesFn,
} from "@/lib/queues/queue-processing-failure"

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
  ackDeadLetter: AckAfterMaxDeliveriesFn = ackAfterMaxDeliveries,
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

  if (!message?.publicId || !message?.eventKey || !message?.visitorSessionId || !message?.eventType) {
    console.error("[PublicFormMetricEventsQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  const input: PublicFormMetricEventInput = {
    visitorSessionId: message.visitorSessionId,
    eventType: message.eventType as PublicFormMetricEventInput["eventType"],
    questionId: message.questionId ?? undefined,
    eventKey: message.eventKey,
    origin: message.origin ?? {},
    answerMappingKey: message.answerMappingKey ?? null,
    answerValue: message.answerValue ?? null,
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

    const acked = await ackDeadLetter({
      deliveryCount: metadata.deliveryCount,
      topic: PUBLIC_FORM_METRIC_EVENTS_TOPIC,
      idempotencyKey: message.eventKey,
      payload: message,
      lastError: error,
    })
    if (acked) {
      console.error(
        "[PublicFormMetricEventsQueueRoute][POST] deliveryCount excedeu o limite, movido para outbox, acking",
        {
          messageId: metadata.messageId,
          deliveryCount: metadata.deliveryCount,
          eventKey: message.eventKey,
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
