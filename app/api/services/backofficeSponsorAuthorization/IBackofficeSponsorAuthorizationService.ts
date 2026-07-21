export interface AuthorizedSponsorOption {
  id: string
  fullName: string | null
  email: string
}

export type SponsorAuthorizationFailureReason =
  | "not_found"
  | "not_master"
  | "not_authorized"

export interface SponsorAuthorizationResult {
  isAuthorized: boolean
  reason?: SponsorAuthorizationFailureReason
  errorMessage: string | null
}

export interface AuthorizedSponsorListItem extends AuthorizedSponsorOption {
  isActive: boolean
  grantedAt: Date
  grantedBy: { id: string; fullName: string | null; email: string } | null
  revokedAt: Date | null
  revokedBy: { id: string; fullName: string | null; email: string } | null
  notes: string | null
  sponsoredAccountsCount: number
}

export interface IBackofficeSponsorAuthorizationService {
  assertAuthorizedSponsor(sponsorProfileId: string): Promise<SponsorAuthorizationResult>
  listAuthorizedSponsors(): Promise<AuthorizedSponsorOption[]>
  listAllWithCounts(): Promise<AuthorizedSponsorListItem[]>
  grant(
    profileId: string,
    grantedByProfileId: string,
    notes?: string | null
  ): Promise<{ record: AuthorizedSponsorListItem } | { error: string }>
  revoke(
    profileId: string,
    revokedByProfileId: string
  ): Promise<{ record: AuthorizedSponsorListItem } | { error: string }>
  countSponsoredAccounts(profileId: string): Promise<number>
  listEligibleMasters(): Promise<AuthorizedSponsorOption[]>
}
