import { QueueClient } from "@vercel/queue"

/**
 * Fila do disparo de campanhas Live do backoffice: tira o envio via Resend do
 * isolate síncrono do cron/`send-now` (mesmo padrão do PR1 do produto,
 * `lib/queues/email-campaign-dispatch.ts`, mas em fila própria — módulo
 * backoffice é isolado, não pode compartilhar tópico/infra com o produto).
 * O publisher só acorda o consumer com `dispatchId`; o consumer processa um
 * lote de logs `queued` por vez.
 */
export const BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_TOPIC = "backoffice-email-campaign-dispatch"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS = 60 * 60 * 24 * 7

const queue = new QueueClient({ region: "gru1" })

export type BackofficeEmailCampaignDispatchWakePayload = {
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
export function buildBackofficeEmailCampaignDispatchIdempotencyKey(
  payload: BackofficeEmailCampaignDispatchWakePayload & { remainingCount?: number }
): string {
  if (payload.reason === "continue") {
    return `${payload.dispatchId}:continue:${payload.remainingCount ?? 0}`
  }
  return `${payload.dispatchId}:${payload.reason}`
}

export async function publishBackofficeEmailCampaignDispatchWake(
  payload: BackofficeEmailCampaignDispatchWakePayload & { remainingCount?: number },
  options?: { idempotencyKey?: string },
): Promise<{ messageId: string | null }> {
  return queue.send(BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_TOPIC, payload, {
    idempotencyKey:
      options?.idempotencyKey ?? buildBackofficeEmailCampaignDispatchIdempotencyKey(payload),
    retentionSeconds: BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleBackofficeEmailCampaignDispatchCallback } = queue
