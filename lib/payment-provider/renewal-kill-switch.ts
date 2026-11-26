/** Variável que liga o corte do Asaas na renovação pelo roteador. Ausente, vazia ou diferente de "true" = desligado. */
export const PROVIDER_RENEWAL_ENABLED_ENV = "PAYMENT_PROVIDER_RENEWAL_ENABLED"

/**
 * Ponto único de leitura do kill switch da renovação. Controla só a passagem da assinatura legada
 * do Asaas para o roteador (cancelar a assinatura recorrente quando a renovação é paga pelo
 * roteador). Desligado, o pagamento da renovação continua funcionando e o Asaas não é tocado.
 */
export function isProviderRenewalEnabled(
  env: Readonly<Partial<Record<string, string | undefined>>> = process.env,
): boolean {
  return env[PROVIDER_RENEWAL_ENABLED_ENV]?.trim().toLowerCase() === "true"
}
