import type { AccountAccessRestrictionReason } from "@/app/api/shared/accountAccessDecision/types"

export type AccessPausedAction = "payment" | "support" | "none"

const PAYMENT_RECOVERY_REASONS: readonly AccountAccessRestrictionReason[] = [
  "past_due",
  "suspended",
  "canceled",
]

const PAYMENT_RECOVERY_SEGMENT = "billing-grace-payment"
const PAYMENT_RECOVERY_PATH_PATTERN = new RegExp(`^/[^/]+/${PAYMENT_RECOVERY_SEGMENT}/?$`)

/**
 * Qual ação a tela de acesso pausado oferece:
 * - payment: o master paga e reativa a conta;
 * - support: banido, ou master sem pagamento possível (assinatura indisponível), fala com o suporte;
 * - none: quem não é master só recebe o aviso.
 */
export function getAccessPausedAction(
  reason: AccountAccessRestrictionReason | undefined,
  isBillingOwner: boolean
): AccessPausedAction {
  if (reason === "banned") return "support"
  if (!isBillingOwner) return "none"
  if (reason && PAYMENT_RECOVERY_REASONS.includes(reason)) return "payment"
  return "support"
}

/** Única rota que o gate libera para a conta pausada: a página de pagamento da própria conta. */
export function isPaymentRecoveryPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname) && PAYMENT_RECOVERY_PATH_PATTERN.test(pathname as string)
}

export function getPaymentRecoveryHref(supabaseId: string): string {
  return `/${supabaseId}/${PAYMENT_RECOVERY_SEGMENT}`
}
