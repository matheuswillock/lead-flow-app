import type { ResendDomainSnapshot } from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"

/** Returns true when persisted status matches the remote Resend API status. */
export function isResendDomainStatusInSync(
  persisted: string | null | undefined,
  remote: string | null | undefined
): boolean {
  return (persisted ?? null) === (remote ?? null)
}

export type PersistedResendDomainSnapshot = {
  resendDomainStatus: string | null
  resendDomainRegion: string | null
  resendOpenTracking: boolean
  resendClickTracking: boolean
}

/**
 * Compares persisted domain fields against a remote Resend snapshot using the
 * same normalization rules as `syncFromResendDomain`.
 */
export function isResendDomainSnapshotInSync(
  persisted: PersistedResendDomainSnapshot,
  remote: ResendDomainSnapshot
): boolean {
  const remoteStatus = remote.status ?? null
  const remoteRegion = remote.region ?? null
  const remoteOpenTracking = Boolean(remote.openTracking ?? remote.open_tracking)
  const remoteClickTracking = Boolean(remote.clickTracking ?? remote.click_tracking)

  return (
    isResendDomainStatusInSync(persisted.resendDomainStatus, remoteStatus) &&
    (persisted.resendDomainRegion ?? null) === remoteRegion &&
    persisted.resendOpenTracking === remoteOpenTracking &&
    persisted.resendClickTracking === remoteClickTracking
  )
}
