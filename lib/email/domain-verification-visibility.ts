type DomainVerificationVisibilityInput = {
  domainStatus: string | null
  domainEvents: Array<{ type: string }>
  verificationRequested: boolean
}

const FAILED_DOMAIN_STATUSES = new Set(["failed", "temporary_failure", "partially_failed"])

export function shouldShowDnsMissingAlerts({
  domainStatus,
  domainEvents,
  verificationRequested,
}: DomainVerificationVisibilityInput): boolean {
  if (verificationRequested || FAILED_DOMAIN_STATUSES.has(domainStatus ?? "")) return true
  return domainEvents.some((event) => event.type === "domain_failed")
}
