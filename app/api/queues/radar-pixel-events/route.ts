import { radarPixelHitUseCase, RadarPixelHitUseCase } from "@/app/api/useCases/radar/RadarPixelHitUseCase"
import {
  buildRadarPixelEventIdempotencyKey,
  handleRadarPixelEventsCallback,
  RADAR_PIXEL_EVENTS_TOPIC,
  type RadarPixelEventPayload,
} from "@/lib/queues/radar-pixel-events"
import {
  ackAfterMaxDeliveries,
  type AckAfterMaxDeliveriesFn,
} from "@/lib/queues/queue-processing-failure"

export const maxDuration = 300

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency: 2).
 * Persiste o hit do pixel fora do isolate HTTP público.
 */
export async function processRadarPixelEventMessage(
  message: RadarPixelEventPayload,
  metadata: QueueMessageMetadata,
  useCase: Pick<RadarPixelHitUseCase, "persistQueuedHit"> = radarPixelHitUseCase,
  ackDeadLetter: AckAfterMaxDeliveriesFn = ackAfterMaxDeliveries,
): Promise<void> {
  console.info("[RadarPixelEventsQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    teamId: message?.teamId,
    eventType: message?.eventType,
  })

  if (!message?.teamId || !message?.visitorSession || !message?.eventType || !message?.publicToken) {
    console.error("[RadarPixelEventsQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  try {
    const result = await useCase.persistQueuedHit(message)
    if (!result.isValid) {
      throw new Error(result.errorMessages.join("; ") || "Falha ao persistir hit do pixel")
    }
    console.info("[RadarPixelEventsQueueRoute][POST] pixel hit persisted", {
      messageId: metadata.messageId,
      teamId: message.teamId,
      eventType: message.eventType,
    })
  } catch (error) {
    console.error("[RadarPixelEventsQueueRoute][POST] persist failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      teamId: message.teamId,
      eventType: message.eventType,
      error,
    })
    const acked = await ackDeadLetter({
      deliveryCount: metadata.deliveryCount,
      topic: RADAR_PIXEL_EVENTS_TOPIC,
      idempotencyKey: buildRadarPixelEventIdempotencyKey(message),
      payload: message,
      lastError: error,
    })
    if (acked) return
    throw error
  }
}

export const POST = handleRadarPixelEventsCallback(
  (message: RadarPixelEventPayload, metadata: QueueMessageMetadata) =>
    processRadarPixelEventMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
