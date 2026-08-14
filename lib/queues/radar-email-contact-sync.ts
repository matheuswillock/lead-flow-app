import { QueueClient } from "@vercel/queue"

/**
 * Wake de lote do outbox D9 (EmailContactRadarSyncOutbox).
 * Não envia 1 mensagem por contato — coalescing via idempotencyKey estável.
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute.
 */
export const RADAR_EMAIL_CONTACT_SYNC_TOPIC = "radar-email-contact-sync"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const RADAR_EMAIL_CONTACT_SYNC_RETENTION_SECONDS = 60 * 60 * 24 * 7

/** Tag/log quando o publish na fila falha (cron republica). */
export const RADAR_EMAIL_CONTACT_SYNC_QUEUE_PUBLISH_FAILED_TAG =
  "radar_email_contact_sync_queue_publish_failed"

export const RADAR_EMAIL_CONTACT_SYNC_WAKE_IDEMPOTENCY_KEY = "radar-email-contact-sync-wake"

const queue = new QueueClient({ region: "gru1" })

export type RadarEmailContactSyncWakePayload = {
  reason: "outbox_due"
}

export async function publishRadarEmailContactSyncWake(
  payload: RadarEmailContactSyncWakePayload = { reason: "outbox_due" }
): Promise<{ messageId: string | null }> {
  return queue.send(RADAR_EMAIL_CONTACT_SYNC_TOPIC, payload, {
    idempotencyKey: RADAR_EMAIL_CONTACT_SYNC_WAKE_IDEMPOTENCY_KEY,
    retentionSeconds: RADAR_EMAIL_CONTACT_SYNC_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleRadarEmailContactSyncCallback } = queue
