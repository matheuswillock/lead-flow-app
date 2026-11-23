import type { PaymentProviderKey } from "./types"

export type CardCheckoutConfig = {
  /** Cartão liberado: configuração do provedor padrão e chave de tokenização disponíveis. */
  readonly cardOffered: boolean
  /** Provedor que tokeniza o cartão no navegador; o front escolhe o campo de cartão por ele. */
  readonly provider: PaymentProviderKey | null
  /** Chave pública do SDK do provedor; não é segredo, só tokeniza. */
  readonly publicKey: string | null
}

export type CardCheckoutDeps = {
  readonly resolveCardAvailability: () => Promise<{ card: boolean }>
  readonly readDefaultProvider: () => Promise<PaymentProviderKey | null>
  /** Quem sabe ler a chave de tokenização de cada provedor. Provedor fora daqui não oferece cartão. */
  readonly publicKeyReaders: Partial<Record<PaymentProviderKey, () => Promise<string | null>>>
}

const NOT_OFFERED: CardCheckoutConfig = { cardOffered: false, provider: null, publicKey: null }

export async function resolveCardCheckout(deps: CardCheckoutDeps): Promise<CardCheckoutConfig> {
  const { card } = await deps.resolveCardAvailability()
  if (!card) return NOT_OFFERED

  const provider = await deps.readDefaultProvider()
  const readPublicKey = provider ? deps.publicKeyReaders[provider] : undefined
  if (!provider || !readPublicKey) return NOT_OFFERED

  const publicKey = await readPublicKey()
  return publicKey ? { cardOffered: true, provider, publicKey } : NOT_OFFERED
}

/** Dependências reais, carregadas sob demanda para a regra acima não puxar Prisma nos testes. */
export const defaultCardCheckoutDeps: CardCheckoutDeps = {
  resolveCardAvailability: async () => {
    const { resolveCardAvailability } = await import("@/lib/payment-methods/availability")
    return resolveCardAvailability()
  },
  readDefaultProvider: async () => {
    const [{ paymentProviderConfigRepository }, { resolvePaymentProviderEnvironment }] = await Promise.all([
      import("@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"),
      import("@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"),
    ])
    const configs = await paymentProviderConfigRepository.list(resolvePaymentProviderEnvironment())
    return configs.find((config) => config.isDefault)?.provider ?? null
  },
  publicKeyReaders: {
    ABACATE_PAY: async () => {
      const { readConfiguredAbacatePublicKey } = await import("@/lib/payment-methods/availability")
      return readConfiguredAbacatePublicKey()
    },
  },
}
