import type { GoogleOAuthConnection } from "@prisma/client"

export type ResolvedBackofficeGoogleOrganizer = {
  connection: GoogleOAuthConnection
  source: "backoffice_user" | "linked_profile"
  backofficeUserId: string
  backofficeUserEmail: string
  timezone: string
  ownerProfileId: string | null
}

export interface IBackofficeGoogleConnectionResolverService {
  resolveForBackofficeUser(backofficeUserId: string): Promise<ResolvedBackofficeGoogleOrganizer | null>
}
