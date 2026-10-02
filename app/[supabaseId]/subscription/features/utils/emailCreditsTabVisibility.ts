/**
 * Regras de visibilidade da aba "Créditos de e-mail" (Ticket 6 / DF-03 / WF-04).
 * Enquanto a feature de e-mail estiver em beta, a aba só aparece para o Grupo Beta de Radar.
 * Fora de beta, managers (e masters) veem a aba para compra self-service.
 */

export type EmailCreditsTabVisibilityInput = {
  isEmailFeatureBeta: boolean
  hasRadarBetaAccess: boolean
  canManageSubscription: boolean
}

export function shouldShowEmailCreditsTab(input: EmailCreditsTabVisibilityInput): boolean {
  if (!input.canManageSubscription) return false
  if (input.isEmailFeatureBeta) return input.hasRadarBetaAccess
  return true
}

export function shouldShowEmailCreditsTeamSelector(input: {
  isMaster: boolean
  teamCount: number
}): boolean {
  return input.isMaster && input.teamCount > 1
}

/**
 * T06/T07: isenção beta gratuita esconde compra; beta cobrado (sem isenção)
 * mostra planos. DA3 (SPEC 21, T-21.5): falha ao carregar o status (500,
 * rede) também esconde os planos — sem isso, um erro transitório virava
 * "Nenhum plano ativo" com o botão "Comprar" habilitado, risco de segundo
 * checkout do mesmo add-on.
 */
export function shouldShowEmailCreditsPurchasePlans(input: {
  isBetaExempt: boolean
  hasError?: boolean
}): boolean {
  if (input.hasError) return false
  return !input.isBetaExempt
}

export function resolveCheckoutNavigationPath(checkoutUrl: string): string | null {
  const trimmed = checkoutUrl.trim()
  if (!trimmed) return null
  try {
    if (trimmed.startsWith("/")) return trimmed
    const url = new URL(trimmed)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return trimmed.startsWith("/") ? trimmed : null
  }
}
