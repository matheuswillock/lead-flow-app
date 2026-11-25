/** Variável que liga a renovação pelo roteador. Ausente, vazia ou diferente de "true" = desligada. */
export const PROVIDER_RENEWAL_ENABLED_ENV = "PAYMENT_PROVIDER_RENEWAL_ENABLED"

/**
 * Ponto único de leitura do kill switch da renovação. Só desliga a renovação pelo roteador:
 * checkout, add-on e regularização não consultam esta variável.
 */
export function isProviderRenewalEnabled(
  env: Readonly<Partial<Record<string, string | undefined>>> = process.env,
): boolean {
  return env[PROVIDER_RENEWAL_ENABLED_ENV]?.trim().toLowerCase() === "true"
}
