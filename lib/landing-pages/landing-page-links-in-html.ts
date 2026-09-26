const LANDING_PAGE_PUBLIC_ID_PATTERN =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"

export function createLandingPageHrefPattern(): RegExp {
  return new RegExp(`(href\\s*=\\s*)([\\\"'])([^\\\"']*?/conversation/${LANDING_PAGE_PUBLIC_ID_PATTERN}[^\\\"']*)\\2`, "gi")
}
