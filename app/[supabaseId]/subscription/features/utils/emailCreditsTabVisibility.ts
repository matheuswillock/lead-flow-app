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

/** T06/T07: isenção beta gratuita esconde compra; beta cobrado (sem isenção) mostra planos. */
export function shouldShowEmailCreditsPurchasePlans(input: {
  isBetaExempt: boolean
}): boolean {
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
