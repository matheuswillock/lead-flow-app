import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository"

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo"
const LOG_PREFIX = "[BackofficeMemberGoogleScopesService]"

type GoogleTokenResult = {
  access_token: string
  expires_in: number
  refresh_token?: string
}

export type MemberGoogleScopesResult = {
  connected: boolean
  scopes: string[]
}

function getOAuthCredentials() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Google OAuth não configuradas")
  }

  return { clientId, clientSecret }
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResult> {
  const { clientId, clientSecret } = getOAuthCredentials()

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  })

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "")
    console.error(`${LOG_PREFIX} Token refresh failed`, { status: response.status, body: rawBody })
    throw new Error("Falha ao renovar token Google")
  }

  return response.json() as Promise<GoogleTokenResult>
}

async function fetchGrantedScopes(accessToken: string): Promise<string[]> {
  const response = await fetch(
    `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`,
    { method: "GET" }
  )

  if (!response.ok) {
    console.error(`${LOG_PREFIX} Tokeninfo failed`, { status: response.status })
    return []
  }

  const tokenInfo = (await response.json()) as { scope?: string }
  return tokenInfo.scope ? tokenInfo.scope.split(" ").filter(Boolean) : []
}

class BackofficeMemberGoogleScopesService {
  constructor(private readonly profileRepo: IProfileRepository) {}

  async getScopesForMember(memberId: string): Promise<MemberGoogleScopesResult> {
    const profile = await this.profileRepo.findById(memberId)

    if (!profile) {
      throw new Error("Membro não encontrado")
    }

    if (!profile.googleCalendarConnected) {
      return { connected: false, scopes: [] }
    }

    let accessToken = profile.googleAccessToken

    const now = Date.now()
    const expiresAt = profile.googleTokenExpiresAt?.getTime() ?? 0
    const tokenExpired = !accessToken || expiresAt <= now + 60_000

    if (tokenExpired) {
      if (!profile.googleRefreshToken || !profile.supabaseId) {
        return { connected: true, scopes: [] }
      }

      try {
        const refreshed = await refreshAccessToken(profile.googleRefreshToken)
        const expiresAtDate = new Date(Date.now() + refreshed.expires_in * 1000)

        await this.profileRepo.updateGoogleCalendarAuth(profile.supabaseId, {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token ?? profile.googleRefreshToken,
          expiresAt: expiresAtDate,
        })

        accessToken = refreshed.access_token
      } catch (err) {
        console.error(`${LOG_PREFIX} Refresh token failed for member ${memberId}`, err)
        return { connected: true, scopes: [] }
      }
    }

    const scopes = await fetchGrantedScopes(accessToken!).catch((err) => {
      console.error(`${LOG_PREFIX} Tokeninfo failed for member ${memberId}`, err)
      return []
    })

    return { connected: true, scopes }
  }
}

export const backofficeMememberGoogleScopesService = new BackofficeMemberGoogleScopesService(
  profileRepository
)
