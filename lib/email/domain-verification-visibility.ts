type DomainVerificationVisibilityInput = {
  domainStatus: string | null
  domainName: string | null
  domainEvents: Array<{ type: string; metadata?: Record<string, unknown> | null }>
  verificationRequested: boolean
}

const FAILED_DOMAIN_STATUSES = new Set(["failed", "temporary_failure", "partially_failed", "partially_verified"])

export function shouldShowDnsMissingAlerts({
  domainStatus,
  domainName,
  domainEvents,
  verificationRequested,
}: DomainVerificationVisibilityInput): boolean {
  if (verificationRequested && FAILED_DOMAIN_STATUSES.has(domainStatus ?? "")) return true

  return domainEvents.some(
    (event) =>
      event.type === "domain_failed" &&
      event.metadata?.domainName === domainName &&
      event.metadata?.status !== "verified",
  )
}
