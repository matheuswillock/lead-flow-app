/** Limiar de idade do dispatch para overflow (mesmo valor histórico de stuck-sending). */
export const STUCK_SENDING_THRESHOLD_MS = 30 * 60 * 1000

/** Idade mínima para reclaim de órfão — evita competir com o lote ainda em voo. */
export const ORPHAN_RESUME_MIN_AGE_MS = 2 * 60 * 1000

/**
 * Granularidade do discriminador temporal das chaves de idempotência dos wakes
 * de recuperação (`cron-start`/`cron-reclaim`).
 *
 * A Vercel Queue deduplica por `idempotencyKey` numa janela de
 * `min(retenção, 24h)` — 24h neste tópico. Uma chave constante por dispatch
 * fazia o cron (que roda a cada 5 min) conseguir acordar um dispatch parado
 * no máximo **uma vez por dia**. Alinhar o bucket à cadência do cron devolve
 * um wake por tick, enquanto retries dentro do mesmo tick continuam
 * deduplicando. Wakes redundantes são inofensivos: `processDispatchQueueBatch`
 * serializa em `runWithDispatchProcessingLock` e faz ack sem reprocessar.
 *
 * Um cursor de progresso não serve como discriminador aqui — um dispatch
 * parado tem cursor imóvel, que é exatamente quando mais se precisa de um
 * wake novo.
 */
export const WAKE_RECOVERY_BUCKET_MS = 5 * 60 * 1000

/** Bucket temporal corrente dos wakes de recuperação. */
export function resolveWakeRecoveryBucket(now: Date = new Date()): number {
  return Math.floor(now.getTime() / WAKE_RECOVERY_BUCKET_MS)
}

export type EmailCampaignDispatchWakeQueue = "main" | "overflow"

/**
 * Timeout não falha a campanha: lotes restantes de um dispatch com 30 min ou
 * mais de idade (`createdAt`) vão para a fila overflow.
 */
export function resolveEmailCampaignDispatchWakeQueue(params: {
  createdAt: Date
  now?: Date
}): EmailCampaignDispatchWakeQueue {
  const now = params.now ?? new Date()
  const ageMs = now.getTime() - params.createdAt.getTime()
  return ageMs >= STUCK_SENDING_THRESHOLD_MS ? "overflow" : "main"
}
