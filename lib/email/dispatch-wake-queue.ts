/** Limiar de idade do dispatch para overflow (mesmo valor histórico de stuck-sending). */
export const STUCK_SENDING_THRESHOLD_MS = 30 * 60 * 1000

/** Idade mínima para reclaim de órfão — evita competir com o lote ainda em voo. */
export const ORPHAN_RESUME_MIN_AGE_MS = 2 * 60 * 1000

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
