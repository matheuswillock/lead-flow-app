const GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo"

export async function fetchGoogleGrantedScopes(accessToken: string): Promise<string[]> {
  const response = await fetch(
    `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`,
    { method: "GET" }
  )

  if (!response.ok) {
    return []
  }

  const tokenInfo = (await response.json()) as { scope?: string }
  return tokenInfo.scope ? tokenInfo.scope.split(" ").filter(Boolean) : []
}
