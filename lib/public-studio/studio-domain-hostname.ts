export function studioHostnameFromEmailDomain(domainName: string | null | undefined): string | null {
  const normalized = domainName?.trim().toLowerCase().replace(/\.$/, "")
  if (!normalized || normalized.includes("/") || normalized.includes(":")) return null
  return `studio.${normalized}`
}
