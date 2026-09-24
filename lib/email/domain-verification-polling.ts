export type DomainVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "temporary_failure"
  | "partially_verified"
  | "partially_failed"

export const DOMAIN_VERIFICATION_POLL_INTERVAL_MS = 10_000
export const DOMAIN_VERIFICATION_POLL_TIMEOUT_MS = 5 * 60 * 1_000

export function isDomainVerificationPollActive(
  pollId: string,
  activePollId: string | null,
): boolean {
  return activePollId === pollId
}

export function isDomainVerificationTerminal(status: DomainVerificationStatus): boolean {
  return status === "verified" || status === "failed" || status === "partially_failed"
}

export function shouldContinueDomainVerificationPolling(
  status: DomainVerificationStatus,
  startedAt: number,
  now: number,
): boolean {
  return !isDomainVerificationTerminal(status) && now - startedAt < DOMAIN_VERIFICATION_POLL_TIMEOUT_MS
}
