import { credentialCache } from "./credential-cache"
import type { PaymentProviderEnvironment } from "./types"

type Env = Record<string, string | undefined>

/**
 * Chave pública do Abacate. Em PRODUCTION ela só existe depois que a loja tem "Checkout próprio"
 * (cartão) liberado; sem ela o cartão fica indisponível. Fonte única de leitura, usada pela
 * composition do provider e pela disponibilidade de métodos de pagamento.
 *
 * Banco primeiro (cache hidratado pelo resolver de credenciais), ambiente como reserva.
 */
export function readAbacatePublicKey(
  environment: PaymentProviderEnvironment,
  env: Env = process.env,
): string | null {
  const cached = credentialCache.peekAndRefresh({ provider: "ABACATE_PAY", environment })
  const fromDatabase = cached?.sources.PUBLIC_KEY === "db" ? cached.values.PUBLIC_KEY : undefined
  if (fromDatabase?.trim()) return fromDatabase
  const value = env[`ABACATE_PAY_${environment}_PUBLIC_KEY`] ?? env.ABACATE_PAY_PUBLIC_KEY
  return value?.trim() ? value : null
}
