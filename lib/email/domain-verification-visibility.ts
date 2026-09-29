type DomainVerificationVisibilityInput = {
  domainStatus: string | null
  domainName: string | null
  domainEvents: Array<{ type: string; metadata?: Record<string, unknown> | null }>
  verificationRequested: boolean
}

export function shouldShowDnsMissingAlerts({
  domainName,
  domainEvents,
  verificationRequested,
}: DomainVerificationVisibilityInput): boolean {
  if (verificationRequested) return true

  return domainEvents.some(
    (event) =>
      event.type === "domain_failed" &&
      event.metadata?.domainName === domainName &&
      event.metadata?.status !== "verified",
  )
}
