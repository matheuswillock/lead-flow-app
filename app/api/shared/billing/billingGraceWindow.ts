const DAY_MS = 24 * 60 * 60 * 1000

/** Dias de carência após o vencimento antes de `past_due` degradar para acesso restrito. */
export const BILLING_GRACE_DAYS = 5

/**
 * Janela de carência de cobrança (vencimento + BILLING_GRACE_DAYS), só para status `past_due`
 * com due date conhecida. Única fonte de verdade para essa janela — compartilhada entre
 * AccountAccessDecisionService (banner "regularize até") e FeatureAccessService (libera CRM
 * durante a carência para Member PRO expirado) para as duas leituras nunca divergirem sobre
 * até quando o acesso continua liberado sem precisar de uma BillingAccessGrace manual.
 */
export function resolveBillingGraceUntil(input: {
  subscriptionStatus: string | null | undefined
  subscriptionNextDueDate: Date | null | undefined
}): Date | null {
  if (input.subscriptionStatus !== "past_due" || !input.subscriptionNextDueDate) {
    return null
  }
  return new Date(input.subscriptionNextDueDate.getTime() + BILLING_GRACE_DAYS * DAY_MS)
}
