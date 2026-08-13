import { QueueClient } from "@vercel/queue"
import type { EmailEventType } from "@prisma/client"

/**
 * Side-effect Radar do webhook Resend (T7b → fila).
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute.
 */
export const RESEND_WEBHOOK_RADAR_EVENTS_TOPIC = "resend-webhook-radar-events"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const RESEND_WEBHOOK_RADAR_EVENTS_RETENTION_SECONDS = 60 * 60 * 24 * 7

/** Tag/log quando o publish na fila falha (fallback síncrono no caller). */
export const RESEND_WEBHOOK_RADAR_QUEUE_PUBLISH_FAILED_TAG =
  "resend_webhook_radar_queue_publish_failed"

const queue = new QueueClient({ region: "gru1" })

export type ResendWebhookRadarEventPayload = {
  teamId: string
  recipientEmail: string
  recipientName?: string | null
  logId: string
  campaignId?: string | null
  eventType: EmailEventType
  occurredAt: string
  metadata?: Record<string, unknown>
  svixId?: string | null
  emailOrphanEventId?: string | null
}

export function buildResendWebhookRadarEventIdempotencyKey(
  payload: Pick<ResendWebhookRadarEventPayload, "svixId" | "emailOrphanEventId" | "logId" | "eventType" | "occurredAt">
): string {
  if (payload.svixId) return payload.svixId
  if (payload.emailOrphanEventId) return `orphan:${payload.emailOrphanEventId}`
  return `log:${payload.logId}:${payload.eventType}:${payload.occurredAt}`
}

export async function publishResendWebhookRadarEvent(
  payload: ResendWebhookRadarEventPayload
): Promise<{ messageId: string | null }> {
  return queue.send(RESEND_WEBHOOK_RADAR_EVENTS_TOPIC, payload, {
    idempotencyKey: buildResendWebhookRadarEventIdempotencyKey(payload),
    retentionSeconds: RESEND_WEBHOOK_RADAR_EVENTS_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleResendWebhookRadarEventsCallback } = queue
