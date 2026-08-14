import { QueueClient } from "@vercel/queue"

/**
 * Hits do pixel Radar (fora do request path público).
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute.
 */
export const RADAR_PIXEL_EVENTS_TOPIC = "radar-pixel-events"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const RADAR_PIXEL_EVENTS_RETENTION_SECONDS = 60 * 60 * 24 * 7

/** Tag/log quando o publish na fila falha (fallback síncrono no caller). */
export const RADAR_PIXEL_EVENTS_QUEUE_PUBLISH_FAILED_TAG = "radar_pixel_events_queue_publish_failed"

export type RadarPixelEventPayload = {
  teamId: string
  publicToken: string
  eventType: string
  visitorSession: string
  origin: string | null
  userAgent: string | null
}

const queue = new QueueClient({ region: "gru1" })

export function utcDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function buildRadarPixelEventIdempotencyKey(
  payload: Pick<RadarPixelEventPayload, "teamId" | "visitorSession" | "eventType">,
  at: Date = new Date()
): string {
  return `${payload.teamId}:${payload.visitorSession}:${payload.eventType}:${utcDayKey(at)}`
}

export async function publishRadarPixelEvent(
  payload: RadarPixelEventPayload
): Promise<{ messageId: string | null }> {
  return queue.send(RADAR_PIXEL_EVENTS_TOPIC, payload, {
    idempotencyKey: buildRadarPixelEventIdempotencyKey(payload),
    retentionSeconds: RADAR_PIXEL_EVENTS_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleRadarPixelEventsCallback } = queue
