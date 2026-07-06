export interface AuthorizedSponsorItem {
  id: string
  fullName: string | null
  email: string
  isActive: boolean
  grantedAt: string
  grantedBy: { id: string; fullName: string | null; email: string } | null
  revokedAt: string | null
  revokedBy: { id: string; fullName: string | null; email: string } | null
  notes: string | null
  sponsoredAccountsCount: number
}

export interface EligibleMasterOption {
  id: string
  fullName: string | null
  email: string
}

export interface AuthorizedSponsorsListResult {
  items: AuthorizedSponsorItem[]
  eligibleMasters: EligibleMasterOption[]
}

export interface IBackofficeAuthorizedSponsorsState {
  items: AuthorizedSponsorItem[]
  eligibleMasters: EligibleMasterOption[]
  isLoading: boolean
  error: string | null
  isGranting: boolean
  isRevokingId: string | null
}

export interface IBackofficeAuthorizedSponsorsActions {
  fetchItems: () => Promise<void>
  grant: (profileId: string, notes?: string | null) => Promise<boolean>
  revoke: (profileId: string) => Promise<boolean>
}

export type IBackofficeAuthorizedSponsorsContext = IBackofficeAuthorizedSponsorsState &
  IBackofficeAuthorizedSponsorsActions
