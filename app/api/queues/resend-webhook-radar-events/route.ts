import { resendWebhookUseCase, ResendWebhookUseCase } from "@/app/api/useCases/resendWebhook/ResendWebhookUseCase"
import {
  buildResendWebhookRadarEventIdempotencyKey,
  handleResendWebhookRadarEventsCallback,
  RESEND_WEBHOOK_RADAR_EVENTS_TOPIC,
  type ResendWebhookRadarEventPayload,
} from "@/lib/queues/resend-webhook-radar-events"
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
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency: 4).
 * Aplica o side-effect Radar do webhook Resend fora do isolate do webhook.
 */
export async function processResendWebhookRadarEventMessage(
  message: ResendWebhookRadarEventPayload,
  metadata: QueueMessageMetadata,
  useCase: Pick<ResendWebhookUseCase, "handleRadarQueueEvent"> = resendWebhookUseCase,
  ackDeadLetter: AckAfterMaxDeliveriesFn = ackAfterMaxDeliveries,
): Promise<void> {
  console.info("[ResendWebhookRadarEventsQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    logId: message?.logId,
    eventType: message?.eventType,
    teamId: message?.teamId,
  })

  if (!message?.teamId || !message?.recipientEmail || !message?.logId || !message?.eventType || !message?.occurredAt) {
    console.error("[ResendWebhookRadarEventsQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  const occurredAt = new Date(message.occurredAt)
  if (Number.isNaN(occurredAt.getTime())) {
    console.error("[ResendWebhookRadarEventsQueueRoute][POST] invalid occurredAt, acking", {
      messageId: metadata.messageId,
      occurredAt: message.occurredAt,
    })
    return
  }

  try {
    await useCase.handleRadarQueueEvent({
      teamId: message.teamId,
      recipientEmail: message.recipientEmail,
      recipientName: message.recipientName,
      logId: message.logId,
      campaignId: message.campaignId,
      eventType: message.eventType,
      occurredAt,
      metadata: message.metadata,
    })
    console.info("[ResendWebhookRadarEventsQueueRoute][POST] radar event handled", {
      messageId: metadata.messageId,
      logId: message.logId,
      eventType: message.eventType,
    })
  } catch (error) {
    console.error("[ResendWebhookRadarEventsQueueRoute][POST] handle failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      logId: message.logId,
      eventType: message.eventType,
      error,
    })
    const acked = await ackDeadLetter({
      deliveryCount: metadata.deliveryCount,
      topic: RESEND_WEBHOOK_RADAR_EVENTS_TOPIC,
      idempotencyKey: buildResendWebhookRadarEventIdempotencyKey(message),
      payload: message,
      lastError: error,
    })
    if (acked) return
    throw error
  }
}

export const POST = handleResendWebhookRadarEventsCallback(
  (message: ResendWebhookRadarEventPayload, metadata: QueueMessageMetadata) =>
    processResendWebhookRadarEventMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
