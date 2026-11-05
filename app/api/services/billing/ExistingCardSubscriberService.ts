import type { NextResponse } from "next/server"
import { createAsaasClient, type AsaasAccountId } from "@/lib/asaas"
import {
  assertCardChoiceAllowedForAccount,
  resolveBillingTypesForAccount,
  type CardSubscriberCandidate,
  type FetchSubscriptionCardInfo,
} from "@/lib/payment-methods/existing-card-subscriber"
import { resolveCardAvailability, type AvailableBillingTypes } from "@/lib/payment-methods/availability"
import { toPaymentMethodUnavailableResponse } from "@/lib/payment-methods/route-guard"

/**
 * Lê a assinatura no Asaas (conta persistida no perfil) para saber se há cartão tokenizado.
 * É a mesma fonte que IncrementalBillingService usa para reaproveitar o token.
 */
export const fetchAsaasSubscriptionCardInfo: FetchSubscriptionCardInfo = async ({
  asaasSubscriptionId,
  asaasSubscriptionAccount,
}) => {
  const client = createAsaasClient(asaasSubscriptionAccount as AsaasAccountId)
  const subscription = await client.request(`${client.endpoints.subscriptions}/${asaasSubscriptionId}`, {
    method: "GET",
  })
  return {
    billingType: subscription?.billingType,
    creditCardToken: subscription?.creditCard?.creditCardToken,
  }
}

/** Lança PaymentMethodUnavailableError quando o cartão é uma NOVA escolha e está desligado. */
export function assertCardChoiceAllowedForMaster(
  billingType: unknown,
  master: CardSubscriberCandidate | null | undefined,
  fetchCardInfo: FetchSubscriptionCardInfo = fetchAsaasSubscriptionCardInfo,
): Promise<void> {
  return assertCardChoiceAllowedForAccount(
    typeof billingType === "string" ? billingType : null,
    master,
    fetchCardInfo,
  )
}

/** Versão para rotas: devolve a resposta 422 pronta, ou null quando o método é permitido. */
export async function rejectUnavailableBillingTypeForMaster(
  billingType: unknown,
  master: CardSubscriberCandidate | null | undefined,
): Promise<NextResponse | null> {
  try {
    await assertCardChoiceAllowedForMaster(billingType, master)
    return null
  } catch (error) {
    const response = toPaymentMethodUnavailableResponse(error)
    if (response) return response
    throw error
  }
}

/** Tipos de cobrança que esta conta pode escolher (inclui cartão para assinante com cartão). */
export async function resolveAvailableBillingTypesForMaster(
  master: CardSubscriberCandidate | null | undefined,
  fetchCardInfo: FetchSubscriptionCardInfo = fetchAsaasSubscriptionCardInfo,
): Promise<AvailableBillingTypes> {
  const { availableBillingTypes } = await resolveCardAvailability()
  return resolveBillingTypesForAccount(master, fetchCardInfo, availableBillingTypes)
}
