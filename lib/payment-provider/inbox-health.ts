/** Limites iniciais da regra de saúde da inbox de eventos do provider (ajustáveis por chamada). */
export const INBOX_FAILED_ALERT_THRESHOLD = 5
export const INBOX_STALLED_ALERT_MINUTES = 30
/** Janela de falhas consideradas: falhas antigas e já tratadas não podem manter o alerta aceso. */
export const INBOX_FAILED_LOOKBACK_HOURS = 24

export type InboxHealthSnapshot = {
  /** Eventos `failed` dentro da janela de observação. */
  readonly failedCount: number
  /** Recebimento do evento ainda não concluído (pending/processing) mais antigo; null se não há. */
  readonly oldestUnfinishedAt: Date | null
}

export type InboxHealthLimits = {
  readonly failedThreshold: number
  readonly stalledMinutes: number
}

export type InboxHealthReason = "FAILED_ABOVE_LIMIT" | "STALLED_TOO_LONG"

export type InboxHealthEvaluation = {
  readonly healthy: boolean
  readonly reasons: readonly InboxHealthReason[]
}

const DEFAULT_LIMITS: InboxHealthLimits = {
  failedThreshold: INBOX_FAILED_ALERT_THRESHOLD,
  stalledMinutes: INBOX_STALLED_ALERT_MINUTES,
}

/** Regra pura: falhas acima de N, ou evento sem andamento há mais de M minutos. */
export function evaluateInboxHealth(
  snapshot: InboxHealthSnapshot,
  now: Date,
  limits: InboxHealthLimits = DEFAULT_LIMITS,
): InboxHealthEvaluation {
  const reasons: InboxHealthReason[] = []
  if (snapshot.failedCount > limits.failedThreshold) reasons.push("FAILED_ABOVE_LIMIT")
  if (snapshot.oldestUnfinishedAt) {
    const stalledMs = now.getTime() - snapshot.oldestUnfinishedAt.getTime()
    if (stalledMs > limits.stalledMinutes * 60_000) reasons.push("STALLED_TOO_LONG")
  }
  return { healthy: reasons.length === 0, reasons }
}
