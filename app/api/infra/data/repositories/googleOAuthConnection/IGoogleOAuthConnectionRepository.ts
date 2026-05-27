import type { GoogleOAuthConnection } from "@prisma/client"

export interface UpdateGoogleOAuthTokensInput {
  accessToken?: string | null
  refreshToken?: string | null
  tokenExpiresAt?: Date | null
  lastRefreshedAt?: Date | null
  lastRefreshError?: string | null
}

export interface CreateGoogleOAuthConnectionInput {
  googleEmail: string
  accessToken?: string | null
  refreshToken?: string | null
  tokenExpiresAt?: Date | null
  ownerProfileId?: string | null
}

export interface IGoogleOAuthConnectionRepository {
  findById(id: string): Promise<GoogleOAuthConnection | null>
  findByGoogleEmail(googleEmail: string): Promise<GoogleOAuthConnection | null>
  create(input: CreateGoogleOAuthConnectionInput): Promise<GoogleOAuthConnection>
  updateTokens(id: string, input: UpdateGoogleOAuthTokensInput): Promise<GoogleOAuthConnection>
  markRevoked(id: string, reason?: string | null): Promise<GoogleOAuthConnection>
  attachToProfile(connectionId: string, profileId: string): Promise<GoogleOAuthConnection>
  attachToBackofficeUser(connectionId: string, backofficeUserId: string): Promise<void>
  detachFromProfile(profileId: string): Promise<void>
  detachFromBackofficeUser(backofficeUserId: string): Promise<void>
}
