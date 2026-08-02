/** Max recipients per sub-campaign (and daily send cap). */
export const EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB = 2000

/** Max emails a team may dispatch in a single civil day. */
export const EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY = 2000

export function formatDailyLimitFailureMessage(used: number, limit: number): string {
  return `Limite diário de ${limit.toLocaleString("pt-BR")} e-mails atingido (${used.toLocaleString("pt-BR")} já usados). Tente amanhã ou reduza o lote`
}

export function formatDailyLimitDispatchBlockMessage(limit: number, remaining: number): string {
  return `Não é possível disparar: limite diário de ${limit.toLocaleString("pt-BR")} e-mails. Restam ${remaining.toLocaleString("pt-BR")} para hoje.`
}

export function isDailyLimitErrorMessage(message: string | null | undefined): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return normalized.includes("limite diário") || normalized.includes("limite diario")
}
