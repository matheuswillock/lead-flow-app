export interface AuthorizedSponsorProfileRow {
  id: string
  fullName: string | null
  email: string
  isMaster: boolean
}

export interface AuthorizedSponsorRecordRow {
  id: string
  profileId: string
  isActive: boolean
  grantedByProfileId: string | null
  grantedAt: Date
  revokedByProfileId: string | null
  revokedAt: Date | null
  notes: string | null
  profile: {
    id: string
    fullName: string | null
    email: string
    isMaster: boolean
  }
  grantedBy: { id: string; fullName: string | null; email: string } | null
  revokedBy: { id: string; fullName: string | null; email: string } | null
}

export interface IBackofficeSponsorAuthorizationRepository {
  findProfileById(profileId: string): Promise<AuthorizedSponsorProfileRow | null>
  findActiveAuthorization(profileId: string): Promise<{ id: string; isActive: boolean } | null>
  listActiveAuthorizedProfiles(): Promise<AuthorizedSponsorProfileRow[]>
  listAllWithAudit(): Promise<AuthorizedSponsorRecordRow[]>
  grant(input: {
    profileId: string
    grantedByProfileId: string
    notes?: string | null
  }): Promise<AuthorizedSponsorRecordRow>
  revoke(input: {
    profileId: string
    revokedByProfileId: string
  }): Promise<AuthorizedSponsorRecordRow | null>
  countSponsoredAccounts(profileId: string): Promise<number>
  listEligibleMasterProfiles(): Promise<AuthorizedSponsorProfileRow[]>
}
