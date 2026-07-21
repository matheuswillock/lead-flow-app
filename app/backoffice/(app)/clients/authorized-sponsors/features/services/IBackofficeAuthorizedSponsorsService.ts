import type {
  AuthorizedSponsorItem,
  AuthorizedSponsorsListResult,
} from "../context/BackofficeAuthorizedSponsorsTypes"

export interface IBackofficeAuthorizedSponsorsService {
  list(): Promise<AuthorizedSponsorsListResult>
  grant(profileId: string, notes?: string | null): Promise<AuthorizedSponsorItem>
  revoke(profileId: string): Promise<AuthorizedSponsorItem>
}
