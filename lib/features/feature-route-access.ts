import { TENANT_ROUTE_PREFIXES } from "@/lib/proxy/route-access"
import { FEATURE_SLUGS } from "./feature-slugs"

type RouteMatcher = {
  prefix: string
  slugs: string[]
}

const PREFIX_TO_FEATURE_SLUGS: Record<string, string | string[]> = {
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
  "/integrations": [FEATURE_SLUGS.CONFIGURATION, FEATURE_SLUGS.RADAR],
  "/forms": FEATURE_SLUGS.PUBLIC_FORMS,
  "/whatsapp/configuracoes": FEATURE_SLUGS.WHATSAPP_SETTINGS,
  "/whatsapp/auto-respostas": FEATURE_SLUGS.WHATSAPP_AUTO_RESPONSES,
  "/whatsapp": FEATURE_SLUGS.WHATSAPP,
  "/radar": FEATURE_SLUGS.RADAR,
  "/email/templates": FEATURE_SLUGS.EMAIL_TEMPLATES,
  "/email/contatos": FEATURE_SLUGS.EMAIL_CONTACTS,
  "/email/campanhas": FEATURE_SLUGS.EMAIL_CAMPAIGNS,
  "/email/configuracoes": FEATURE_SLUGS.EMAIL_SETTINGS,
  "/email/descadastro": FEATURE_SLUGS.EMAIL_UNSUBSCRIBE,
  "/email": FEATURE_SLUGS.EMAIL,
}

const routeMatchers: RouteMatcher[] = [...TENANT_ROUTE_PREFIXES]
  .filter((prefix) => prefix in PREFIX_TO_FEATURE_SLUGS)
  .map((prefix) => {
    const entry = PREFIX_TO_FEATURE_SLUGS[prefix]
    return { prefix, slugs: Array.isArray(entry) ? entry : [entry] }
  })

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

export function getFeatureSlugsForAppPath(pathname: string): string[] {
  const route = resolveTenantRoutePath(pathname)
  if (!route) return []
  const matcher = routeMatchers.find((item) => route.startsWith(item.prefix))
  return matcher?.slugs ?? []
}
