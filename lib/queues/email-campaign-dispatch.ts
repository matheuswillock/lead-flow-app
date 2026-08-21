import { QueueClient } from "@vercel/queue"

/**
 * Fila do disparo de campanhas (Fase 4 / PR1): tira o envio via Resend do
 * isolate síncrono do cron/`POST /send` (que hoje estoura maxDuration em
 * campanhas grandes). O publisher só acorda o consumer com `dispatchId`;
 * o consumer reconstrói destinatários a partir dos logs `queued` (mesmo
 * padrão de `EmailCampaignUseCase.resumeOrphanSendingDispatches`).
 *
 * Overflow (PR6): disparos com idade >= 30 min não falham — os lotes
 * restantes vão para `email-campaign-dispatch-overflow` (concurrency 1)
 * para não ocupar os 4 slots da fila principal.
 */
export const EMAIL_CAMPAIGN_DISPATCH_TOPIC = "email-campaign-dispatch"
export const EMAIL_CAMPAIGN_DISPATCH_OVERFLOW_TOPIC = "email-campaign-dispatch-overflow"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS = 60 * 60 * 24 * 7

const queue = new QueueClient({ region: "gru1" })
const overflowQueue = new QueueClient({ region: "gru1" })

export type EmailCampaignDispatchWakePayload = {
  dispatchId: string
  /** Só para log/observabilidade; não influencia o processamento. */
  reason: "start" | "cron-start" | "cron-reclaim" | "continue"
}

/**
 * Idempotência: `start`/`cron-start`/`cron-reclaim` usam a própria
 * `dispatchId` (uma única publicação "inicial" por gatilho). `continue`
 * (republish após lote parcial) usa `remainingCount` — retries do mesmo
 * estado (mesma quantidade restante) deduplicam; progresso real gera uma
 * chave nova.
 */
export function buildEmailCampaignDispatchIdempotencyKey(
  payload: EmailCampaignDispatchWakePayload & { remainingCount?: number }
): string {
  if (payload.reason === "continue") {
    return `${payload.dispatchId}:continue:${payload.remainingCount ?? 0}`
  }
  return `${payload.dispatchId}:${payload.reason}`
}

export async function publishEmailCampaignDispatchWake(
  payload: EmailCampaignDispatchWakePayload & { remainingCount?: number },
  options?: { idempotencyKey?: string },
): Promise<{ messageId: string | null }> {
  return queue.send(EMAIL_CAMPAIGN_DISPATCH_TOPIC, payload, {
    idempotencyKey: options?.idempotencyKey ?? buildEmailCampaignDispatchIdempotencyKey(payload),
    retentionSeconds: EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
  })
}

export async function publishEmailCampaignDispatchOverflowWake(
  payload: EmailCampaignDispatchWakePayload & { remainingCount?: number },
  options?: { idempotencyKey?: string },
): Promise<{ messageId: string | null }> {
  return overflowQueue.send(EMAIL_CAMPAIGN_DISPATCH_OVERFLOW_TOPIC, payload, {
    idempotencyKey: options?.idempotencyKey ?? buildEmailCampaignDispatchIdempotencyKey(payload),
    retentionSeconds: EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleEmailCampaignDispatchCallback } = queue
export const { handleCallback: handleEmailCampaignDispatchOverflowCallback } = overflowQueue
