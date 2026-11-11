/**
 * Somente leitura (dias 6 a 15 do vencimento): a plataforma "some". Só ficam o CRM e a
 * Carteira, para visualização, e a página de pagamento para o master.
 */

export type ReadOnlyNavItem = { title: string; url: string }

const READ_ONLY_VIEW_PATH_PATTERN = /^\/[^/]+\/(crm|carteira)(\/.*)?$/
const PAYMENT_PATH_PATTERN = /^\/[^/]+\/billing-grace-payment\/?$/

export function isReadOnlyAllowedPath(
  pathname: string | null | undefined,
  isBillingOwner: boolean
): boolean {
  if (!pathname) return false
  if (READ_ONLY_VIEW_PATH_PATTERN.test(pathname)) return true
  return isBillingOwner && PAYMENT_PATH_PATTERN.test(pathname)
}

export function getReadOnlyHomeHref(supabaseId: string): string {
  return `/${supabaseId}/crm`
}

export function getReadOnlyNavItems(supabaseId: string, canSeeWallet: boolean): ReadOnlyNavItem[] {
  const items: ReadOnlyNavItem[] = [{ title: "CRM", url: `/${supabaseId}/crm` }]
  if (canSeeWallet) items.push({ title: "Carteira", url: `/${supabaseId}/carteira` })
  return items
}
