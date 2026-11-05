import {
  assertBillingTypeAllowed,
  type AvailableBillingTypes,
  type CardEnabledReader,
} from "./availability"

export interface CardSubscriberCandidate {
  asaasSubscriptionId?: string | null
  asaasSubscriptionAccount?: string | null
}

export interface ProviderSubscriptionCardInfo {
  billingType: string | null | undefined
  creditCardToken?: string | null
}

export type FetchSubscriptionCardInfo = (subscription: {
  asaasSubscriptionId: string
  asaasSubscriptionAccount: string
}) => Promise<ProviderSubscriptionCardInfo>

const PLACEHOLDER_SUBSCRIPTION_PREFIXES = ["external-adhesion-", "adhesion-"]

function hasRealSubscriptionId(id: string | null | undefined): id is string {
  if (!id) return false
  return !PLACEHOLDER_SUBSCRIPTION_PREFIXES.some((prefix) => id.startsWith(prefix))
}

/**
 * Assinante com cartão = assinatura real no Asaas cobrada em CREDIT_CARD e com token ativo
 * (o mesmo token que a cobrança incremental e a recriação de assinatura reutilizam).
 * Qualquer falha de consulta falha fechada: sem confirmação, não há isenção.
 */
export async function isExistingCardSubscriber(
  candidate: CardSubscriberCandidate | null | undefined,
  fetchCardInfo: FetchSubscriptionCardInfo,
): Promise<boolean> {
  if (!candidate || !hasRealSubscriptionId(candidate.asaasSubscriptionId)) return false
  try {
    const info = await fetchCardInfo({
      asaasSubscriptionId: candidate.asaasSubscriptionId,
      asaasSubscriptionAccount: candidate.asaasSubscriptionAccount ?? "primary",
    })
    return info.billingType === "CREDIT_CARD" && Boolean(info.creditCardToken)
  } catch {
    return false
  }
}

/**
 * Barra a nova escolha de cartão; só consulta o provider quando o cartão está desligado e o
 * método pedido é CREDIT_CARD (caminho barato nos demais casos).
 */
export async function assertCardChoiceAllowedForAccount(
  billingType: string | null | undefined,
  candidate: CardSubscriberCandidate | null | undefined,
  fetchCardInfo: FetchSubscriptionCardInfo,
  env: Record<string, string | undefined> = process.env,
  readCardEnabled?: CardEnabledReader,
): Promise<void> {
  if (billingType !== "CREDIT_CARD") return
  try {
    await assertBillingTypeAllowed(billingType, {}, env, readCardEnabled)
  } catch (error) {
    const existingCardSubscriber = await isExistingCardSubscriber(candidate, fetchCardInfo)
    if (!existingCardSubscriber) throw error
  }
}

/** Para GETs de detalhe: tipos de cobrança que ESTA conta pode escolher agora. */
export async function resolveBillingTypesForAccount(
  candidate: CardSubscriberCandidate | null | undefined,
  fetchCardInfo: FetchSubscriptionCardInfo,
  availableBillingTypes: AvailableBillingTypes,
): Promise<AvailableBillingTypes> {
  if (availableBillingTypes.includes("CREDIT_CARD")) return availableBillingTypes
  return (await isExistingCardSubscriber(candidate, fetchCardInfo))
    ? ["PIX", "CREDIT_CARD"]
    : availableBillingTypes
}
