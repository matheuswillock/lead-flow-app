import {
  processRadarProfileSyncUseCase,
  ProcessRadarProfileSyncUseCase,
} from "@/app/api/useCases/radar/ProcessRadarProfileSyncUseCase"
import {
  handleRadarProfileSyncCallback,
  type RadarProfileSyncPayload,
} from "@/lib/queues/radar-profile-sync"

export const maxDuration = 300

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

const VALID_SOURCES = new Set([
  "crm",
  "portfolio",
  "finalized",
  "email_settings",
  "bulk_import_finalize",
])

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency: 2).
 * Roteia o sync de perfil Radar pelo `source` — Route → UseCase.
 */
export async function processRadarProfileSyncMessage(
  message: RadarProfileSyncPayload,
  metadata: QueueMessageMetadata,
  useCase: Pick<ProcessRadarProfileSyncUseCase, "execute"> = processRadarProfileSyncUseCase
): Promise<void> {
  console.info("[RadarProfileSyncQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    source: message?.source,
    teamId: message?.teamId,
  })

  if (!message?.teamId || !VALID_SOURCES.has(message.source)) {
    console.error("[RadarProfileSyncQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  try {
    const result = await useCase.execute(message)
    if (!result.isValid) {
      throw new Error(result.errorMessages.join("; ") || "Falha no sync de perfil Radar")
    }
    console.info("[RadarProfileSyncQueueRoute][POST] profile sync handled", {
      messageId: metadata.messageId,
      source: message.source,
      teamId: message.teamId,
    })
  } catch (error) {
    console.error("[RadarProfileSyncQueueRoute][POST] execute failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      source: message.source,
      teamId: message.teamId,
      error,
    })
    throw error
  }
}

export const POST = handleRadarProfileSyncCallback(
  (message: RadarProfileSyncPayload, metadata: QueueMessageMetadata) =>
    processRadarProfileSyncMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
