/** Dias de antecedência em que a cobrança do ciclo seguinte é criada (spec M13, PAY-RENEW-T003). */
export const RENEWAL_LEAD_DAYS = 5

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Chave de idempotência do ciclo: a mesma assinatura no mesmo vencimento gera sempre a mesma chave.
 * Repetir o cron não cria segunda cobrança, porque o ledger tem unicidade por (conta, chave).
 */
export function renewalIdempotencyKey(input: { readonly profileId: string; readonly dueDate: Date }): string {
  return `renewal:${input.profileId}:${input.dueDate.toISOString()}`
}

/** Vencimento ainda não passou e cai até `RENEWAL_LEAD_DAYS` dias a partir de `now`. */
export function isInRenewalWindow(dueDate: Date, now: Date, leadDays = RENEWAL_LEAD_DAYS): boolean {
  const remaining = dueDate.getTime() - now.getTime()
  return remaining >= 0 && remaining <= leadDays * DAY_MS
}
