import { QueueClient } from "@vercel/queue"

/**
 * Espelho WhatsApp → Radar (mensagem pontual ou wake de histórico).
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute.
 */
export const WHATSAPP_RADAR_EVENTS_TOPIC = "whatsapp-radar-events"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const WHATSAPP_RADAR_EVENTS_RETENTION_SECONDS = 60 * 60 * 24 * 7

/** Tag/log quando o publish na fila falha (fallback síncrono no caller). */
export const WHATSAPP_RADAR_EVENTS_QUEUE_PUBLISH_FAILED_TAG =
  "whatsapp_radar_events_queue_publish_failed"

export type WhatsappRadarEventPayload =
  | { source: "message"; teamId: string; messageId: string }
  | { source: "history"; teamId: string; since: string }

const queue = new QueueClient({ region: "gru1" })

export function buildWhatsappRadarEventIdempotencyKey(
  payload: WhatsappRadarEventPayload
): string {
  if (payload.source === "message") {
    return `${payload.teamId}:${payload.messageId}`
  }
  return `${payload.teamId}:history:${payload.since}`
}

export async function publishWhatsappRadarEvent(
  payload: WhatsappRadarEventPayload
): Promise<{ messageId: string | null }> {
  return queue.send(WHATSAPP_RADAR_EVENTS_TOPIC, payload, {
    idempotencyKey: buildWhatsappRadarEventIdempotencyKey(payload),
    retentionSeconds: WHATSAPP_RADAR_EVENTS_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleWhatsappRadarEventsCallback } = queue
