import type { GoogleOAuthConnection } from "@prisma/client"
import { googleOAuthConnectionRepository } from "@/app/api/infra/data/repositories/googleOAuthConnection/GoogleOAuthConnectionRepository"
import { fetchGoogleGrantedScopes } from "@/lib/google/scopes"

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const LOG_PREFIX = "[getScopesForGoogleConnection]"

export type GoogleConnectionScopesResult = {
  connected: boolean
  scopes: string[]
}

type GoogleTokenResult = {
  access_token: string
  expires_in: number
  refresh_token?: string
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

export async function getScopesForGoogleConnection(
  connection: GoogleOAuthConnection
): Promise<GoogleConnectionScopesResult> {
  if (connection.revokedAt) {
    return { connected: false, scopes: [] }
  }

  if (connection.scopes && connection.scopes.length > 0) {
    return { connected: true, scopes: connection.scopes }
  }

  let accessToken = connection.accessToken

  const now = Date.now()
  const expiresAt = connection.tokenExpiresAt?.getTime() ?? 0
  const tokenExpired = !accessToken || expiresAt <= now + 60_000

  if (tokenExpired) {
    if (!connection.refreshToken) {
      return { connected: true, scopes: [] }
    }

    try {
      const refreshed = await refreshAccessToken(connection.refreshToken)
      const expiresAtDate = new Date(Date.now() + refreshed.expires_in * 1000)
      await googleOAuthConnectionRepository.updateTokens(connection.id, {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? connection.refreshToken,
        tokenExpiresAt: expiresAtDate,
      })

      accessToken = refreshed.access_token
    } catch (err) {
      console.error(`${LOG_PREFIX} Refresh token failed for connection ${connection.id}`, err)
      return { connected: true, scopes: [] }
    }
  }

  const scopes = await fetchGoogleGrantedScopes(accessToken!).catch((err) => {
    console.error(`${LOG_PREFIX} Tokeninfo failed for connection ${connection.id}`, err)
    return [] as string[]
  })
  await googleOAuthConnectionRepository.updateTokens(connection.id, { scopes })

  return { connected: true, scopes }
}
