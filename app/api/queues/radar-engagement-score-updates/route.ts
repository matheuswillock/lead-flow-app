import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import type { RadarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import {
  handleRadarEngagementScoreUpdatesCallback,
  type RadarEngagementScoreUpdatePayload,
} from "@/lib/queues/radar-engagement-score-updates"

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency: 1).
 * Recalcula engagement score de forma idempotente (recompute from events).
 */
export async function processRadarEngagementScoreUpdateMessage(
  message: RadarEngagementScoreUpdatePayload,
  metadata: QueueMessageMetadata,
  repository: Pick<RadarRepository, "updateEngagementScore"> = radarRepository
): Promise<void> {
  console.info("[RadarEngagementScoreUpdatesQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    profileId: message?.profileId,
    teamId: message?.teamId,
  })

  if (!message?.profileId || !message?.teamId) {
    console.error("[RadarEngagementScoreUpdatesQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  try {
    await repository.updateEngagementScore(message.profileId, message.teamId)
    console.info("[RadarEngagementScoreUpdatesQueueRoute][POST] engagement score updated", {
      messageId: metadata.messageId,
      profileId: message.profileId,
      teamId: message.teamId,
    })
  } catch (error) {
    console.error("[RadarEngagementScoreUpdatesQueueRoute][POST] update failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      profileId: message.profileId,
      teamId: message.teamId,
      error,
    })
    throw error
  }
}

export const POST = handleRadarEngagementScoreUpdatesCallback(
  (message: RadarEngagementScoreUpdatePayload, metadata: QueueMessageMetadata) =>
    processRadarEngagementScoreUpdateMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  }
)
