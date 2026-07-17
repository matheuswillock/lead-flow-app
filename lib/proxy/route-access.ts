export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const PUBLIC_PAGE_ROUTES = [
  "/",
  "/operator-confirmed",
  "/pix-confirmed",
  "/set-password",
  "/forgot-password",
  "/adesao/expirado",
  "/auth/callback",
  "/terms",
  "/privacy-policy",
  "/cookies",
  "/recursos",
  "/prime",
  "/checkout-return",
  "/lead-form",
  "/agendamento",
  "/addon-checkout",
  "/sentry-example-page",
] as const

/** Prefixos públicos (match por startsWith). */
const PUBLIC_PAGE_ROUTE_PREFIXES = [
  "/recursos/",
  "/lead-form/",
  "/agendamento/",
  "/addon-checkout/",
] as const

export const TENANT_ROUTE_PREFIXES = [
  "/dashboard",
  "/crm",
  "/lead-transfers",
  "/associados",
  "/calendar",
  "/performance",
  "/pme-simulador",
  "/carteira",
  "/teams",
  "/manager-users",
  "/integrations",
  "/whatsapp/configuracoes",
  "/whatsapp/auto-respostas",
  "/whatsapp",
  "/cdp",
  "/email/templates",
  "/email/contatos",
  "/email/campanhas",
  "/email/historico",
  "/email/configuracoes",
  "/email/descadastro",
  "/email",
  "/account",
  "/board",
  "/pipeline",
  "/notifications",
  "/docs",
  "/subscription",
] as const

export const MANAGER_ONLY_ROUTE_PREFIXES = ["/manager-users", "/integrations"] as const

export const AUTH_REDIRECT_ROUTES = ["/sign-in"] as const

export type TenantPath = {
  tenantId: string
  routePath: string
}

export function parseTenantPath(pathname: string): TenantPath | null {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length < 2) return null

  const tenantId = segments[0]
  if (!UUID_RE.test(tenantId)) return null

  const routePath = `/${segments.slice(1).join("/")}`
  return { tenantId, routePath }
}

export function isAuthRedirectRoute(pathname: string): boolean {
  return (AUTH_REDIRECT_ROUTES as readonly string[]).includes(pathname)
}

export function isPublicPageRoute(pathname: string): boolean {
  if ((PUBLIC_PAGE_ROUTES as readonly string[]).includes(pathname)) {
    return true
  }

  return PUBLIC_PAGE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function isLegacyTenantRoute(pathname: string): boolean {
  return TENANT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function isTenantAppRoute(pathname: string): boolean {
  return parseTenantPath(pathname) !== null
}

export function requiresAuth(pathname: string): boolean {
  return isLegacyTenantRoute(pathname) || isTenantAppRoute(pathname)
}

/**
 * Match exato de segmento para `/backoffice` — evita que rotas irmãs como
 * `/backoffice-email-unsubscribe` ou `/backoffice-lead-form` sejam tratadas
 * como parte do app autenticado do backoffice por um `startsWith` ingênuo.
 */
export function isBackofficeAppRoute(pathname: string): boolean {
  return pathname === "/backoffice" || pathname.startsWith("/backoffice/")
}

function resolveAppRoutePath(pathname: string): string {
  const tenant = parseTenantPath(pathname)
  if (tenant) return tenant.routePath
  return pathname
}

export function requiresManagerRole(pathname: string): boolean {
  const routePath = resolveAppRoutePath(pathname)
  return MANAGER_ONLY_ROUTE_PREFIXES.some(
    (prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`)
  )
}

export function isSensitiveRoute(pathname: string): boolean {
  return requiresAuth(pathname) || isBackofficeAppRoute(pathname)
}
