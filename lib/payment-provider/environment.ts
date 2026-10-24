import type { PaymentProviderEnvironment } from "./types"

type Env = Readonly<Record<string, string | undefined>>

/**
 * Ambiente de execução do provider (PAY-CRED-T017): derivado do deploy. `PRODUCTION` só quando
 * `VERCEL_ENV === "production"`; qualquer outro deploy (preview, local) usa `DEV`.
 *
 * @deprecated `PAYMENT_PROVIDER_ENVIRONMENT` continua com precedência apenas por compatibilidade
 * e deve ser removida da Vercel depois do cutover (PAY-CRED-T016).
 * Retorna null quando a variável legada está definida com valor inválido.
 */
export function derivePaymentProviderEnvironment(
  env: Env = process.env,
): PaymentProviderEnvironment | null {
  const legacy = env.PAYMENT_PROVIDER_ENVIRONMENT
  if (legacy !== undefined) return legacy === "DEV" || legacy === "PRODUCTION" ? legacy : null
  return env.VERCEL_ENV === "production" ? "PRODUCTION" : "DEV"
}
