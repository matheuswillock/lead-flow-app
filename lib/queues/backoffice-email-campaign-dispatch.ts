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

/**
 * Janela de bucket para as chaves `cron-start`/`cron-reclaim` — alinhada à
 * cadência do cron `/api/v1/backoffice/cron/dispatch-email-campaigns`
 * (a cada 15 min, ver vercel.json). Sem isso, `dispatchId:cron-reclaim` é uma
 * chave constante: dentro da janela de dedupe da Vercel Queue
 * (`min(retenção, 24h)` = 24h), só a primeira publicação do dia é entregue —
 * se ela se perder, o cron fica incapaz de acordar o dispatch travado por
 * até 24h mesmo rodando a cada 15 min.
 */
export const BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_WAKE_RECOVERY_BUCKET_MS = 15 * 60 * 1000

const queue = new QueueClient({ region: "gru1" })

export type BackofficeEmailCampaignDispatchWakePayload = {
  dispatchId: string
  /** Só para log/observabilidade; não influencia o processamento. */
  reason: "start" | "cron-start" | "cron-reclaim" | "continue"
}

function resolveBackofficeEmailCampaignDispatchWakeBucket(now: Date = new Date()): number {
  return Math.floor(now.getTime() / BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_WAKE_RECOVERY_BUCKET_MS)
}

/**
 * Idempotência:
 * - `start` usa a própria `dispatchId` (protege contra duplo clique —
 *   uma única publicação "inicial" por disparo manual).
 * - `cron-start`/`cron-reclaim` usam `dispatchId:reason:wakeBucket` — o
 *   bucket temporal garante uma chave nova a cada janela do cron (15 min),
 *   em vez de uma chave constante que trava novas tentativas por 24h.
 * - `continue` (republish após lote parcial) usa `batchOffset` — cursor de
 *   progresso monotonicamente crescente, namespaced como `continue:offset:N`
 *   para não colidir com chaves `continue:N` (remainingCount) já retidas na
 *   fila por até 24h — um deploy no meio de um disparo em andamento poderia,
 *   sem esse namespace, gerar `d:continue:3000` tanto pelo `remainingCount`
 *   de uma mensagem antiga quanto pelo `batchOffset` de uma nova, e a Vercel
 *   Queue deduplicaria a segunda como se fosse retry da primeira.
 *   `remainingCount` é fallback só para mensagens em trânsito publicadas
 *   antes desta mudança.
 */
export function buildBackofficeEmailCampaignDispatchIdempotencyKey(
  payload: BackofficeEmailCampaignDispatchWakePayload & {
    remainingCount?: number
    batchOffset?: number
  },
  options?: { now?: Date }
): string {
  if (payload.reason === "continue") {
    if (payload.batchOffset != null) {
      return `${payload.dispatchId}:continue:offset:${payload.batchOffset}`
    }
    return `${payload.dispatchId}:continue:${payload.remainingCount ?? 0}`
  }
  if (payload.reason === "cron-start" || payload.reason === "cron-reclaim") {
    const bucket = resolveBackofficeEmailCampaignDispatchWakeBucket(options?.now)
    return `${payload.dispatchId}:${payload.reason}:${bucket}`
  }
  return `${payload.dispatchId}:${payload.reason}`
}

export async function publishBackofficeEmailCampaignDispatchWake(
  payload: BackofficeEmailCampaignDispatchWakePayload & {
    remainingCount?: number
    batchOffset?: number
  },
  options?: { idempotencyKey?: string; now?: Date },
): Promise<{ messageId: string | null }> {
  return queue.send(BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_TOPIC, payload, {
    idempotencyKey:
      options?.idempotencyKey ??
      buildBackofficeEmailCampaignDispatchIdempotencyKey(payload, { now: options?.now }),
    retentionSeconds: BACKOFFICE_EMAIL_CAMPAIGN_DISPATCH_RETENTION_SECONDS,
  })
}

export const { handleCallback: handleBackofficeEmailCampaignDispatchCallback } = queue
