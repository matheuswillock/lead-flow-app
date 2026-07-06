import { TENANT_ROUTE_PREFIXES } from "@/lib/proxy/route-access"
import { FEATURE_SLUGS } from "./feature-slugs"

type RouteMatcher = {
  prefix: string
  slug: string
}

const PREFIX_TO_FEATURE_SLUG: Record<string, string> = {
  "/dashboard": FEATURE_SLUGS.CRM_DASHBOARD,
  "/crm": FEATURE_SLUGS.CRM,
  "/lead-transfers": FEATURE_SLUGS.CRM_LEAD_TRANSFERS,
  "/calendar": FEATURE_SLUGS.CRM_CALENDAR,
  "/performance": FEATURE_SLUGS.CRM_PERFORMANCE,
  "/pme-simulador": FEATURE_SLUGS.CRM_SIMULATOR,
  "/carteira": FEATURE_SLUGS.CRM_WALLET,
  "/automations": FEATURE_SLUGS.CRM_AUTOMATIONS,
  "/teams": FEATURE_SLUGS.CRM_TIME_MANAGE_TEAMS,
  "/manager-users": FEATURE_SLUGS.CRM_TIME_MANAGE_USERS,
  "/integrations": FEATURE_SLUGS.CONFIGURATION,
  "/whatsapp/configuracoes": FEATURE_SLUGS.WHATSAPP_SETTINGS,
  "/whatsapp/auto-respostas": FEATURE_SLUGS.WHATSAPP_AUTO_RESPONSES,
  "/whatsapp": FEATURE_SLUGS.WHATSAPP,
  "/cdp": FEATURE_SLUGS.CDP,
  "/email/templates": FEATURE_SLUGS.EMAIL_TEMPLATES,
  "/email/contatos": FEATURE_SLUGS.EMAIL_CONTACTS,
  "/email/campanhas": FEATURE_SLUGS.EMAIL_CAMPAIGNS,
  "/email/historico": FEATURE_SLUGS.EMAIL_HISTORY,
  "/email/configuracoes": FEATURE_SLUGS.EMAIL_SETTINGS,
  "/email": FEATURE_SLUGS.EMAIL,
}

const routeMatchers: RouteMatcher[] = [...TENANT_ROUTE_PREFIXES]
  .filter((prefix) => prefix in PREFIX_TO_FEATURE_SLUG)
  .map((prefix) => ({
    prefix,
    slug: PREFIX_TO_FEATURE_SLUG[prefix],
  }))

function resolveTenantRoutePath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length < 2) return null
  return `/${segments.slice(1).join("/")}`
}

export function isAssociadosAppPath(pathname: string): boolean {
  const route = resolveTenantRoutePath(pathname)
  if (!route) return false
  return route === "/associados" || route.startsWith("/associados/")
}

export function getFeatureSlugForAppPath(pathname: string): string | null {
  const route = resolveTenantRoutePath(pathname)
  if (!route) return null
  const matcher = routeMatchers.find((item) => route.startsWith(item.prefix))
  return matcher?.slug ?? null
}
