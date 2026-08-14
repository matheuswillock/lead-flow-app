import { processEmailContactRadarSyncOutboxUseCase } from "@/app/api/useCases/radar/ProcessEmailContactRadarSyncOutboxUseCase"
import type { ProcessEmailContactRadarSyncOutboxUseCase } from "@/app/api/useCases/radar/ProcessEmailContactRadarSyncOutboxUseCase"
import {
  handleRadarEmailContactSyncCallback,
  type RadarEmailContactSyncWakePayload,
} from "@/lib/queues/radar-email-contact-sync"

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
 * Acorda um lote do outbox D9 — concurrency 1 por isolate (`connection_limit=1`).
 */
export async function processRadarEmailContactSyncWakeMessage(
  message: RadarEmailContactSyncWakePayload,
  metadata: QueueMessageMetadata,
  useCase: Pick<ProcessEmailContactRadarSyncOutboxUseCase, "execute"> = processEmailContactRadarSyncOutboxUseCase
): Promise<void> {
  console.info("[RadarEmailContactSyncQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    reason: message?.reason,
  })

  if (message?.reason !== "outbox_due") {
    console.error("[RadarEmailContactSyncQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  try {
    const result = await useCase.execute({ source: "queue" })
    if (!result.isValid) {
      throw new Error(result.errorMessages.join("; ") || "Falha ao processar outbox D9")
    }
    console.info("[RadarEmailContactSyncQueueRoute][POST] outbox batch processed", {
      messageId: metadata.messageId,
      claimed: (result.result as { claimed?: number } | null)?.claimed,
    })
  } catch (error) {
    console.error("[RadarEmailContactSyncQueueRoute][POST] execute failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      error,
    })
    throw error
  }
}

export const POST = handleRadarEmailContactSyncCallback(
  (message: RadarEmailContactSyncWakePayload, metadata: QueueMessageMetadata) =>
    processRadarEmailContactSyncWakeMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
