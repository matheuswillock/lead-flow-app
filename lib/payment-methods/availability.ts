import { readAbacatePublicKey } from "@/lib/payment-provider/public-key"
import type { PaymentProviderEnvironment } from "@/lib/payment-provider/types"

export type BillingType = "PIX" | "CREDIT_CARD"
export type AvailableBillingTypes = BillingType[]

export type CardAvailabilityReason = "AVAILABLE" | "PROVIDER_WITHOUT_CARD" | "DISABLED_BY_FLAG"

export interface CardAvailability {
  card: boolean
  reason: CardAvailabilityReason
  availableBillingTypes: AvailableBillingTypes
}

type Env = Record<string, string | undefined>

const UNAVAILABLE_MESSAGE =
  "O pagamento com cartão de crédito está temporariamente indisponível. Use o PIX."

export class PaymentMethodUnavailableError extends Error {
  readonly status = 422
  readonly code = "PAYMENT_METHOD_UNAVAILABLE"

  constructor(message: string = UNAVAILABLE_MESSAGE) {
    super(message)
    this.name = "PaymentMethodUnavailableError"
  }
}

function resolveEnvironment(env: Env): PaymentProviderEnvironment | null {
  const configured = env.PAYMENT_PROVIDER_ENVIRONMENT ?? "DEV"
  return configured === "DEV" || configured === "PRODUCTION" ? configured : null
}

function build(card: boolean, reason: CardAvailabilityReason): CardAvailability {
  return { card, reason, availableBillingTypes: card ? ["PIX", "CREDIT_CARD"] : ["PIX"] }
}

/**
 * Fonte única de "o cartão pode ser oferecido agora?". Vale para todos os checkouts, inclusive
 * os que cobram pelo Asaas: o cartão só volta quando o Abacate tiver a chave pública (cartão
 * liberado na loja). CARD_PAYMENTS_ENABLED=false desliga sem deploy. Falha fechada.
 */
export function resolveCardAvailability(env: Env = process.env): CardAvailability {
  if (env.CARD_PAYMENTS_ENABLED === "false") return build(false, "DISABLED_BY_FLAG")
  const environment = resolveEnvironment(env)
  if (!environment || !readAbacatePublicKey(environment, env)) {
    return build(false, "PROVIDER_WITHOUT_CARD")
  }
  return build(true, "AVAILABLE")
}

/**
 * Barra a NOVA escolha de cartão. Quem já tem cartão cadastrado (cobrança incremental,
 * recriação de assinatura com o token existente) não é afetado.
 */
export function assertBillingTypeAllowed(
  billingType: string | null | undefined,
  options: { existingCardSubscriber?: boolean } = {},
  env: Env = process.env,
): void {
  if (billingType !== "CREDIT_CARD") return
  if (options.existingCardSubscriber) return
  if (resolveCardAvailability(env).card) return
  throw new PaymentMethodUnavailableError()
}
