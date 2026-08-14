import type { ProcessWhatsappRadarEventUseCase } from "@/app/api/useCases/whatsapp/ProcessWhatsappRadarEventUseCase"
import {
  handleWhatsappRadarEventsCallback,
  type WhatsappRadarEventPayload,
} from "@/lib/queues/whatsapp-radar-events"

export const maxDuration = 300

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

function isValidPayload(message: WhatsappRadarEventPayload | null | undefined): boolean {
  if (!message?.teamId || (message.source !== "message" && message.source !== "history")) {
    return false
  }
  if (message.source === "message") return Boolean(message.messageId)
  if (!message.since) return false
  return !Number.isNaN(new Date(message.since).getTime())
}

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency: 2).
 * Roteia mensagem pontual ou wake de histórico WhatsApp → Radar.
 */
export async function processWhatsappRadarEventMessage(
  message: WhatsappRadarEventPayload,
  metadata: QueueMessageMetadata,
  useCase?: Pick<ProcessWhatsappRadarEventUseCase, "execute">
): Promise<void> {
  console.info("[WhatsappRadarEventsQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    source: message?.source,
    teamId: message?.teamId,
  })

  if (!isValidPayload(message)) {
    console.error("[WhatsappRadarEventsQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  const resolved =
    useCase ??
    (await import("@/app/api/useCases/whatsapp/ProcessWhatsappRadarEventUseCase"))
      .processWhatsappRadarEventUseCase

  try {
    const result = await resolved.execute(message)
    if (!result.isValid) {
      throw new Error(result.errorMessages.join("; ") || "Falha no sync WhatsApp → Radar")
    }
    console.info("[WhatsappRadarEventsQueueRoute][POST] radar event handled", {
      messageId: metadata.messageId,
      source: message.source,
      teamId: message.teamId,
    })
  } catch (error) {
    console.error("[WhatsappRadarEventsQueueRoute][POST] execute failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      source: message.source,
      teamId: message.teamId,
      error,
    })
    throw error
  }
}

export const POST = handleWhatsappRadarEventsCallback(
  (message: WhatsappRadarEventPayload, metadata: QueueMessageMetadata) =>
    processWhatsappRadarEventMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
