import { QueueClient } from "@vercel/queue"
import type { AsaasWebhookBody } from "@/app/api/webhooks/asaas/processAsaasWebhookEvent"

/**
 * Fila do webhook Asaas (PR2.2 — after() só publica, sem processamento
 * síncrono no isolate do webhook). O processamento de negócio continua em
 * processAsaasWebhookEvent(), só quem invoca muda.
 * Região fixa em `gru1` para alinhar com `vercel.json` / Fluid Compute.
 */
export const ASAAS_WEBHOOK_EVENTS_TOPIC = "asaas-webhook-events"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const ASAAS_WEBHOOK_EVENTS_RETENTION_SECONDS = 60 * 60 * 24 * 7

const queue = new QueueClient({ region: "gru1" })

export type AsaasWebhookEventPayload = {
  eventId: string
  body: AsaasWebhookBody
}

export async function publishAsaasWebhookEvent(
  payload: AsaasWebhookEventPayload,
  options?: { idempotencyKey?: string },
): Promise<{ messageId: string | null }> {
  return queue.send(ASAAS_WEBHOOK_EVENTS_TOPIC, payload, {
    idempotencyKey: options?.idempotencyKey ?? payload.eventId,
    retentionSeconds: ASAAS_WEBHOOK_EVENTS_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleAsaasWebhookEventsCallback } = queue
