import { isPaymentCohort, type PaymentCohort } from "./types"

/** Coorte efetiva da assinatura. Ausência ou valor inválido nunca promove ninguém ao router. */
export function resolveCohortFromSubscription(
  subscription: { readonly paymentCohort?: unknown } | null | undefined,
): PaymentCohort {
  return isPaymentCohort(subscription?.paymentCohort) ? subscription.paymentCohort : "ASAAS"
}

/**
 * Mesma regra do backfill: o `subscriptionId` do Profile da adesão é `asaasPaymentId` quando há
 * cobrança Asaas; sem ela vira `external-adhesion-`/`adhesion-`, ou seja, não há assinatura
 * Asaas real e a conta nasceu pelo router.
 */
export function cohortForPaidAdhesion(adhesion: {
  readonly billingType?: string | null
  readonly asaasPaymentId?: string | null
}): PaymentCohort {
  if (adhesion.billingType === "EXTERNAL") return "ROUTER"
  return adhesion.asaasPaymentId ? "ASAAS" : "ROUTER"
}
