import type { OneTimePaymentCapability } from "./contracts"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "./types"

export type ProviderSelection = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
}

export type ProviderFactory = (
  environment: PaymentProviderEnvironment,
  externalAccountContext: string,
) => Promise<OneTimePaymentCapability>

/**
 * Único lugar que liga a chave do provedor (escolhida pelo roteador a partir da configuração) à sua
 * implementação. Trocar ou somar um provedor é registrar uma fábrica aqui; ninguém mais referencia
 * um provedor concreto.
 */
export function createProviderResolver(factories: Partial<Record<PaymentProviderKey, ProviderFactory>>) {
  return async (selection: ProviderSelection): Promise<OneTimePaymentCapability> => {
    const factory = factories[selection.provider]
    if (!factory) throw new Error(`Provedor de pagamento não suportado: ${selection.provider}`)
    return factory(selection.environment, selection.externalAccountContext)
  }
}
