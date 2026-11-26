/**
 * Somente leitura (carência de cobrança expirada): continua tudo que a conta já tinha
 * contratado antes, só em modo leitura. A rota é liberada quando ela não exige nenhum
 * slug de feature, ou quando a conta tem acesso a pelo menos um dos slugs que ela exige
 * (mesma regra que `LayoutContent` já usa pra decidir `shouldBlockByFeature`, pra não
 * duplicar essa lógica uma terceira vez). A página de pagamento fica liberada só pro
 * master (quem resolve a cobrança).
 */
import { getFeatureSlugsForAppPath } from "@/lib/features/feature-route-access"

const PAYMENT_PATH_PATTERN = /^\/pagamento\/[^/]+\/?$/

export function isReadOnlyAllowedPath(
  pathname: string | null | undefined,
  isBillingOwner: boolean,
  hasAccess: (slug: string) => boolean
): boolean {
  if (!pathname) return false
  if (PAYMENT_PATH_PATTERN.test(pathname)) return isBillingOwner
  const requiredSlugs = getFeatureSlugsForAppPath(pathname)
  if (requiredSlugs.length === 0) return true
  return requiredSlugs.some(hasAccess)
}

export function getReadOnlyHomeHref(supabaseId: string): string {
  return `/${supabaseId}/crm`
}
