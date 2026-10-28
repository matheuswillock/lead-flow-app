import { readAbacatePublicKey } from "@/lib/payment-provider/public-key"
import type { PaymentProviderEnvironment } from "@/lib/payment-provider/types"

export type BillingType = "PIX" | "CREDIT_CARD"
export type AvailableBillingTypes = BillingType[]

export type CardAvailabilityReason =
  | "AVAILABLE"
  | "PROVIDER_WITHOUT_CARD"
  | "DISABLED_BY_FLAG"
  | "DISABLED_BY_BACKOFFICE"

export interface CardAvailability {
  card: boolean
  reason: CardAvailabilityReason
  availableBillingTypes: AvailableBillingTypes
}

type Env = Record<string, string | undefined>

/** Lê a flag de cartão que o backoffice grava na config do Abacate. Falha fechada (false). */
export type CardEnabledReader = (environment: PaymentProviderEnvironment) => Promise<boolean>

const UNAVAILABLE_MESSAGE =
  "O pagamento com cartão de crédito está temporariamente indisponível. Use o PIX."

const CARD_ENABLED_CACHE_TTL_MS = 30_000

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
 * Regra pura de "o cartão pode ser oferecido agora?". Exige as três condições: o kill por
 * ambiente (CARD_PAYMENTS_ENABLED) não estar em "false", o dono ter ligado o cartão no
 * backoffice e a loja ter a chave pública do Abacate. Falha fechada.
 */
export function computeCardAvailability(input: {
  cardEnabled: boolean
  env?: Env
}): CardAvailability {
  const env = input.env ?? process.env
  if (env.CARD_PAYMENTS_ENABLED === "false") return build(false, "DISABLED_BY_FLAG")
  if (!input.cardEnabled) return build(false, "DISABLED_BY_BACKOFFICE")
  const environment = resolveEnvironment(env)
  if (!environment || !readAbacatePublicKey(environment, env)) {
    return build(false, "PROVIDER_WITHOUT_CARD")
  }
  return build(true, "AVAILABLE")
}

const cardEnabledCache = new Map<PaymentProviderEnvironment, { value: boolean; expiresAt: number }>()

/**
 * Leitor padrão: config do ABACATE_PAY no banco, com cache curto; qualquer erro vira "desligado".
 * O repositório é carregado sob demanda para que importar só a regra (ou o erro) não puxe o Prisma.
 */
export const readCardEnabledFromConfig: CardEnabledReader = async (environment) => {
  const cached = cardEnabledCache.get(environment)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  try {
    const { paymentProviderConfigRepository } = await import(
      "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
    )
    const configs = await paymentProviderConfigRepository.list(environment)
    const value = configs.find((config) => config.provider === "ABACATE_PAY")?.cardEnabled === true
    cardEnabledCache.set(environment, { value, expiresAt: Date.now() + CARD_ENABLED_CACHE_TTL_MS })
    return value
  } catch {
    return false
  }
}

/** Esvazia o cache; usado quando o dono altera a flag e nos testes. */
export function clearCardEnabledCache(): void {
  cardEnabledCache.clear()
}

/**
 * Fonte única de "o cartão pode ser oferecido agora?". Vale para todos os checkouts, inclusive
 * os que cobram pelo Asaas. O dono liga o cartão no backoffice depois que o Abacate o liberar.
 */
export async function resolveCardAvailability(
  env: Env = process.env,
  readCardEnabled: CardEnabledReader = readCardEnabledFromConfig,
): Promise<CardAvailability> {
  const environment = resolveEnvironment(env)
  if (!environment) return build(false, "PROVIDER_WITHOUT_CARD")
  return computeCardAvailability({ cardEnabled: await readCardEnabled(environment), env })
}

/**
 * Barra a NOVA escolha de cartão. Quem já tem cartão cadastrado (cobrança incremental,
 * recriação de assinatura com o token existente) não é afetado.
 */
export async function assertBillingTypeAllowed(
  billingType: string | null | undefined,
  options: { existingCardSubscriber?: boolean } = {},
  env: Env = process.env,
  readCardEnabled: CardEnabledReader = readCardEnabledFromConfig,
): Promise<void> {
  if (billingType !== "CREDIT_CARD") return
  if (options.existingCardSubscriber) return
  if ((await resolveCardAvailability(env, readCardEnabled)).card) return
  throw new PaymentMethodUnavailableError()
}
