import { readInstallmentLedger } from "@/lib/backoffice-adhesions/installment-ledger"
import { isPaymentCohort, type PaymentCohort } from "./types"

/** Coorte efetiva da assinatura. Ausência ou valor inválido nunca promove ninguém ao router. */
export function resolveCohortFromSubscription(
  subscription: { readonly paymentCohort?: unknown } | null | undefined,
): PaymentCohort {
  return isPaymentCohort(subscription?.paymentCohort) ? subscription.paymentCohort : "ASAAS"
}

/**
 * Mesma regra do backfill: o `subscriptionId` do Profile da adesão é `asaasPaymentId` quando há
 * cobrança Asaas; sem ela vira `external-adhesion-`/`adhesion-`. Adesão parcelada pode ter as
 * cobranças só no `installmentLedger` (sem `asaasPaymentId`): parcela ASAAS pendente, ou paga com
 * cobrança Asaas real, também mantém a conta na coorte ASAAS. EXTERNAL é sempre router.
 */
export function cohortForPaidAdhesion(adhesion: {
  readonly billingType?: string | null
  readonly asaasPaymentId?: string | null
  readonly installmentLedger?: unknown
}): PaymentCohort {
  if (adhesion.billingType === "EXTERNAL") return "ROUTER"
  if (adhesion.asaasPaymentId) return "ASAAS"
  return hasAsaasInstallment(adhesion.installmentLedger) ? "ASAAS" : "ROUTER"
}

function hasAsaasInstallment(installmentLedger: unknown): boolean {
  return readInstallmentLedger(installmentLedger).some(
    (entry) => entry.paymentSource === "ASAAS" && (entry.status === "pending" || entry.asaasPaymentId !== null),
  )
}
