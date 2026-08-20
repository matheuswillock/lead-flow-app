import { QueueClient } from "@vercel/queue"
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes"

/**
 * Fila do webhook Resend (PR2.1 — after() só publica, sem transação Postgres
 * no isolate do webhook). O processamento de negócio continua em
 * ResendWebhookUseCase.handle(), só quem invoca muda.
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute.
 */
export const RESEND_WEBHOOK_EMAILLOG_EVENTS_TOPIC = "resend-webhook-emaillog-events"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const RESEND_WEBHOOK_EMAILLOG_EVENTS_RETENTION_SECONDS = 60 * 60 * 24 * 7

const queue = new QueueClient({ region: "gru1" })

export type ResendWebhookEmailLogEventPayload = {
  event: ResendWebhookPayload
  svixId: string
}

export async function publishResendWebhookEmailLogEvent(
  payload: ResendWebhookEmailLogEventPayload,
  options?: { idempotencyKey?: string },
): Promise<{ messageId: string | null }> {
  return queue.send(RESEND_WEBHOOK_EMAILLOG_EVENTS_TOPIC, payload, {
    idempotencyKey: options?.idempotencyKey ?? payload.svixId,
    retentionSeconds: RESEND_WEBHOOK_EMAILLOG_EVENTS_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleResendWebhookEmailLogEventsCallback } = queue
