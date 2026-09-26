const LANDING_PAGE_ID_SEGMENT = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const LANDING_API_SUFFIXES = "(?:events|submissions)"

export function isPathAllowedOnLandingHost(pathname: string): boolean {
  if (pathname.startsWith("/conversation/")) return true
  if (pathname.startsWith("/_next/")) return true
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true
  return new RegExp(
    `^/api/(?:q|v1)/conversation/${LANDING_PAGE_ID_SEGMENT}/${LANDING_API_SUFFIXES}/?$`,
    "i",
  ).test(pathname)
}
