/**
 * Decide se o inbox deve ser limpo ao conectar um número diferente do último
 * número que já esteve conectado nesta config.
 */
export function shouldWipeInboxOnPhoneChange(
  previousNormalizedPhone: string | null | undefined,
  nextNormalizedPhone: string
): boolean {
  if (!previousNormalizedPhone) return false
  return previousNormalizedPhone !== nextNormalizedPhone
}
