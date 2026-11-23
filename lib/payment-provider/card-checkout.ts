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
  /** Mesma escolha do roteador que cobra: o campo de cartão e a cobrança nunca divergem de provedor. */
  readonly selectCardProvider: () => Promise<PaymentProviderKey | null>
  /** Quem sabe ler a chave de tokenização de cada provedor. Provedor fora daqui não oferece cartão. */
  readonly publicKeyReaders: Partial<Record<PaymentProviderKey, () => Promise<string | null>>>
}

const NOT_OFFERED: CardCheckoutConfig = { cardOffered: false, provider: null, publicKey: null }

export async function resolveCardCheckout(deps: CardCheckoutDeps): Promise<CardCheckoutConfig> {
  const { card } = await deps.resolveCardAvailability()
  if (!card) return NOT_OFFERED

  const provider = await deps.selectCardProvider()
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
  selectCardProvider: async () => {
    const { createPaymentProviderRouter, resolvePaymentProviderEnvironment } = await import(
      "@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition"
    )
    const environment = resolvePaymentProviderEnvironment()
    try {
      const router = await createPaymentProviderRouter(environment)
      const selected = await router.select({ environment, requiredCapabilities: ["ONE_TIME_PAYMENT", "CARD"] })
      return selected.provider
    } catch {
      // Sem provedor elegível para cartão (roteamento, kill switch, capacidade): cartão não é oferecido.
      return null
    }
  },
  publicKeyReaders: {
    ABACATE_PAY: async () => {
      const { readConfiguredAbacatePublicKey } = await import("@/lib/payment-methods/availability")
      return readConfiguredAbacatePublicKey()
    },
  },
}
