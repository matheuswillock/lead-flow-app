import { FEATURE_SLUGS } from "./feature-slugs"

type RouteMatcher = {
  prefix: string
  slug: string
}

const routeMatchers: RouteMatcher[] = [
  { prefix: "/dashboard", slug: FEATURE_SLUGS.CRM_DASHBOARD },
  { prefix: "/crm", slug: FEATURE_SLUGS.CRM },
  { prefix: "/calendar", slug: FEATURE_SLUGS.CRM_CALENDAR },
  { prefix: "/performance", slug: FEATURE_SLUGS.CRM_PERFORMANCE },
  { prefix: "/pme-simulador", slug: FEATURE_SLUGS.CRM_SIMULATOR },
  { prefix: "/carteira", slug: FEATURE_SLUGS.CRM_WALLET },
  { prefix: "/teams", slug: FEATURE_SLUGS.CRM_TIME_MANAGE_TEAMS },
  { prefix: "/manager-users", slug: FEATURE_SLUGS.CRM_TIME_MANAGE_USERS },
  { prefix: "/integrations", slug: FEATURE_SLUGS.CONFIGURATION },
  { prefix: "/email/templates", slug: FEATURE_SLUGS.EMAIL_TEMPLATES },
  { prefix: "/email/contatos", slug: FEATURE_SLUGS.EMAIL_CONTACTS },
  { prefix: "/email/campanhas", slug: FEATURE_SLUGS.EMAIL_CAMPAIGNS },
  { prefix: "/email/historico", slug: FEATURE_SLUGS.EMAIL_HISTORY },
  { prefix: "/email/analytics", slug: FEATURE_SLUGS.EMAIL_ANALYTICS },
  { prefix: "/email", slug: FEATURE_SLUGS.EMAIL },
]

export function getFeatureSlugForAppPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length < 2) return null
  // Build the route from segment index 1 onward (skip the supabaseId prefix)
  const route = "/" + segments.slice(1).join("/")
  const matcher = routeMatchers.find((item) => route.startsWith(item.prefix))
  return matcher?.slug ?? null
}
