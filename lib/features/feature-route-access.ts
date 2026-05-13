import { FEATURE_SLUGS } from "./feature-slugs"

type RouteMatcher = {
  prefix: string
  slug: string
}

const routeMatchers: RouteMatcher[] = [
  { prefix: "/dashboard", slug: FEATURE_SLUGS.CRM_DASHBOARD },
  { prefix: "/crm", slug: FEATURE_SLUGS.CRM_CRM },
  { prefix: "/calendar", slug: FEATURE_SLUGS.CRM_CALENDAR },
  { prefix: "/performance", slug: FEATURE_SLUGS.CRM_PERFORMANCE },
  { prefix: "/pme-simulador", slug: FEATURE_SLUGS.CRM_SIMULATOR },
  { prefix: "/teams", slug: FEATURE_SLUGS.CRM_TIME_MANAGE_TEAMS },
  { prefix: "/manager-users", slug: FEATURE_SLUGS.CRM_TIME_MANAGE_USERS },
  { prefix: "/email", slug: FEATURE_SLUGS.EMAIL },
]

export function getFeatureSlugForAppPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length < 2) return null
  const route = `/${segments[1]}`
  const matcher = routeMatchers.find((item) => route.startsWith(item.prefix))
  return matcher?.slug ?? null
}

