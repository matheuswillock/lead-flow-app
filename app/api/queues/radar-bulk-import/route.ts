import type { RadarBaseImportUseCase } from "@/app/api/useCases/radar/RadarBaseImportUseCase"
import {
  handleRadarBulkImportCallback,
  type RadarBulkImportPayload,
} from "@/lib/queues/radar-bulk-import"

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
 * Processa um lote de 500 linhas por isolate — sem `Promise.all` de linhas.
 */
export async function processRadarBulkImportMessage(
  message: RadarBulkImportPayload,
  metadata: QueueMessageMetadata,
  useCase?: Pick<RadarBaseImportUseCase, "processClaimedBatch">
): Promise<void> {
  console.info("[RadarBulkImportQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    jobId: message?.jobId,
    batchIndex: message?.batchIndex,
  })

  if (!message?.jobId || typeof message.batchIndex !== "number" || message.batchIndex < 0) {
    console.error("[RadarBulkImportQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  const resolved =
    useCase ?? (await import("@/app/api/useCases/radar/RadarBaseImportUseCase")).radarBaseImportUseCase

  try {
    const result = await resolved.processClaimedBatch(message, {
      deliveryCount: metadata.deliveryCount,
    })
    if (!result.isValid) {
      throw new Error(result.errorMessages.join("; ") || "Falha ao processar lote de importação")
    }
    console.info("[RadarBulkImportQueueRoute][POST] batch processed", {
      messageId: metadata.messageId,
      jobId: message.jobId,
      batchIndex: message.batchIndex,
    })
  } catch (error) {
    console.error("[RadarBulkImportQueueRoute][POST] execute failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      jobId: message.jobId,
      batchIndex: message.batchIndex,
      error,
    })
    throw error
  }
}

export const POST = handleRadarBulkImportCallback(
  (message: RadarBulkImportPayload, metadata: QueueMessageMetadata) =>
    processRadarBulkImportMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
