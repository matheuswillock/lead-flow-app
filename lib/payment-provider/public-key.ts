import type { PaymentProviderEnvironment } from "./types"

type Env = Record<string, string | undefined>

/**
 * Chave pública do Abacate. Em PRODUCTION ela só existe depois que a loja tem "Checkout próprio"
 * (cartão) liberado; sem ela o cartão fica indisponível. Fonte única de leitura, usada pela
 * composition do provider e pela disponibilidade de métodos de pagamento.
 */
export function readAbacatePublicKey(
  environment: PaymentProviderEnvironment,
  env: Env = process.env,
): string | null {
  const value = env[`ABACATE_PAY_${environment}_PUBLIC_KEY`] ?? env.ABACATE_PAY_PUBLIC_KEY
  return value?.trim() ? value : null
}
