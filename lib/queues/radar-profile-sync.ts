import { createHash } from "node:crypto"
import { QueueClient } from "@vercel/queue"

/**
 * Sync CRM / portfólio / finalizado / email settings → Radar (fora do request path).
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute.
 */
export const RADAR_PROFILE_SYNC_TOPIC = "radar-profile-sync"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const RADAR_PROFILE_SYNC_RETENTION_SECONDS = 60 * 60 * 24 * 7

/** Tag/log quando o publish na fila falha (fallback síncrono no caller). */
export const RADAR_PROFILE_SYNC_QUEUE_PUBLISH_FAILED_TAG = "radar_profile_sync_queue_publish_failed"

export type RadarProfileSyncSource =
  | "crm"
  | "portfolio"
  | "finalized"
  | "email_settings"
  | "bulk_import_finalize"

export type RadarProfileSyncPayload = {
  source: RadarProfileSyncSource
  teamId: string
  sourceId?: string
  leadId?: string
  leadIds?: string[]
}

const queue = new QueueClient({ region: "gru1" })

export function buildRadarProfileSyncIdempotencyKey(
  payload: Pick<RadarProfileSyncPayload, "source" | "teamId" | "sourceId" | "leadId" | "leadIds">
): string {
  if (payload.leadIds && payload.leadIds.length > 0) {
    const hash = createHash("sha256")
      .update([...payload.leadIds].sort().join(","))
      .digest("hex")
      .slice(0, 16)
    return `${payload.teamId}:${payload.source}:${hash}`
  }
  return `${payload.teamId}:${payload.source}:${payload.sourceId ?? payload.leadId ?? payload.teamId}`
}

export async function publishRadarProfileSync(
  payload: RadarProfileSyncPayload
): Promise<{ messageId: string | null }> {
  return queue.send(RADAR_PROFILE_SYNC_TOPIC, payload, {
    idempotencyKey: buildRadarProfileSyncIdempotencyKey(payload),
    retentionSeconds: RADAR_PROFILE_SYNC_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleRadarProfileSyncCallback } = queue
