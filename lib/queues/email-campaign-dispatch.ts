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
  /** Legado do `continue`: quantidade restante. Mantido só como fallback de chave. */
  remainingCount?: number
  /** `continue`: cursor de materialização após o lote — cresce a cada lote. */
  batchOffset?: number
  /** `cron-start`/`cron-reclaim`: bucket temporal (ver `resolveWakeRecoveryBucket`). */
  wakeBucket?: number
}

/**
 * Idempotência por reason. A Vercel Queue deduplica numa janela de
 * `min(retenção, 24h)` — 24h aqui —, então toda chave precisa de um
 * discriminador que mude quando a mensagem representa trabalho novo.
 *
 * - `start`: chave estável de propósito. O `dispatchId` já é único por envio
 *   e a estabilidade protege contra duplo clique no disparo manual.
 * - `continue`: `batchOffset` (cursor de materialização após o lote). Cresce
 *   monotonicamente, garantindo chave nova a cada lote. Antes usava
 *   `remainingCount`, que era constante (`batchSize`) sempre que o lote
 *   esvaziava a fila mas ainda havia audiência a materializar — a colisão que
 *   travou os disparos em produção. `remainingCount` fica como fallback para
 *   mensagens em trânsito publicadas antes desta mudança.
 * - `cron-start`/`cron-reclaim`: `wakeBucket` temporal. Sem ele, o cron
 *   conseguia acordar um dispatch parado no máximo uma vez por dia.
 */
export function buildEmailCampaignDispatchIdempotencyKey(
  payload: EmailCampaignDispatchWakePayload
): string {
  if (payload.reason === "continue") {
    return `${payload.dispatchId}:continue:${payload.batchOffset ?? payload.remainingCount ?? 0}`
  }
  if (payload.reason === "cron-start" || payload.reason === "cron-reclaim") {
    return `${payload.dispatchId}:${payload.reason}:${payload.wakeBucket ?? 0}`
  }
  return `${payload.dispatchId}:${payload.reason}`
}

export async function publishEmailCampaignDispatchWake(
  payload: EmailCampaignDispatchWakePayload,
  options?: { idempotencyKey?: string },
): Promise<{ messageId: string | null }> {
  return queue.send(EMAIL_CAMPAIGN_DISPATCH_TOPIC, payload, {
    idempotencyKey: options?.idempotencyKey ?? buildEmailCampaignDispatchIdempotencyKey(payload),
    retentionSeconds: EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
  })
}

export async function publishEmailCampaignDispatchOverflowWake(
  payload: EmailCampaignDispatchWakePayload,
  options?: { idempotencyKey?: string },
): Promise<{ messageId: string | null }> {
  return overflowQueue.send(EMAIL_CAMPAIGN_DISPATCH_OVERFLOW_TOPIC, payload, {
    idempotencyKey: options?.idempotencyKey ?? buildEmailCampaignDispatchIdempotencyKey(payload),
    retentionSeconds: EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleEmailCampaignDispatchCallback } = queue
export const { handleCallback: handleEmailCampaignDispatchOverflowCallback } = overflowQueue
