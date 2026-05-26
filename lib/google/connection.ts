import type { GoogleOAuthConnection } from "@prisma/client"

type BackofficeConnectionContext = {
  googleConnection: GoogleOAuthConnection | null
  linkedCorretorStudioProfile: {
    googleConnection: GoogleOAuthConnection | null
  } | null
}

export function isGoogleConnectionActive(
  connection?: { refreshToken: string | null; revokedAt: Date | null } | null
): boolean {
  return !!connection?.refreshToken && !connection.revokedAt
}

export function resolveBackofficeGoogleConnection(user: BackofficeConnectionContext): {
  connection: GoogleOAuthConnection
  source: "backoffice_user" | "linked_profile"
} | null {
  if (isGoogleConnectionActive(user.googleConnection)) {
    return { connection: user.googleConnection as GoogleOAuthConnection, source: "backoffice_user" }
  }

  if (isGoogleConnectionActive(user.linkedCorretorStudioProfile?.googleConnection)) {
    const linkedConnection = user.linkedCorretorStudioProfile?.googleConnection
    if (!linkedConnection) return null
    return {
      connection: linkedConnection,
      source: "linked_profile",
    }
  }

  return null
}
