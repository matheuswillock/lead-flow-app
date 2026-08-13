import { QueueClient } from "@vercel/queue"

/**
 * Recálculo assíncrono de engagement score do Radar (T7b → fila).
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute.
 */
export const RADAR_ENGAGEMENT_SCORE_UPDATES_TOPIC = "radar-engagement-score-updates"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const RADAR_ENGAGEMENT_SCORE_UPDATES_RETENTION_SECONDS = 60 * 60 * 24 * 7

/** Tag/log quando o publish na fila falha (fallback síncrono no repositório). */
export const RADAR_ENGAGEMENT_SCORE_QUEUE_PUBLISH_FAILED_TAG =
  "radar_engagement_score_queue_publish_failed"

const queue = new QueueClient({ region: "gru1" })

export type RadarEngagementScoreUpdatePayload = {
  profileId: string
  teamId: string
}

export function buildRadarEngagementScoreUpdateIdempotencyKey(
  teamId: string,
  profileId: string
): string {
  return `${teamId}:${profileId}`
}

export async function publishRadarEngagementScoreUpdate(
  payload: RadarEngagementScoreUpdatePayload
): Promise<{ messageId: string | null }> {
  return queue.send(RADAR_ENGAGEMENT_SCORE_UPDATES_TOPIC, payload, {
    idempotencyKey: buildRadarEngagementScoreUpdateIdempotencyKey(
      payload.teamId,
      payload.profileId
    ),
    retentionSeconds: RADAR_ENGAGEMENT_SCORE_UPDATES_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleRadarEngagementScoreUpdatesCallback } = queue
