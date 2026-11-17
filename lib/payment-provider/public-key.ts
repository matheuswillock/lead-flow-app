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

export async function readConfiguredAbacatePublicKey(
  environment: PaymentProviderEnvironment,
  env: Env = process.env,
): Promise<string | null> {
  try {
    const { paymentProviderConfigRepository } = await import(
      "@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository"
    )
    const configured = await paymentProviderConfigRepository.readPublicVariable(
      "ABACATE_PAY",
      environment,
      `ABACATE_PAY_${environment}_PUBLIC_KEY`,
    )
    if (configured?.trim()) return configured.trim()
  } catch {
    // .env remains a compatibility fallback while existing deployments migrate.
  }
  return readAbacatePublicKey(environment, env)
}
