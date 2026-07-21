import { getFullUrl } from "@/lib/utils/app-url"

/** Must match `auth.email.otp_expiry` in supabase/config.toml (max 86400 on hosted Supabase). */
export const AUTH_SET_PASSWORD_LINK_EXPIRY_SECONDS = 86_400

export const AUTH_SET_PASSWORD_LINK_EXPIRY_LABEL = "24 horas"

type SupabaseEmailLinkType = "invite" | "recovery"

type SupabaseGeneratedLinkData = {
  properties?: {
    action_link?: string
    hashed_token?: string
  }
}

export function buildSetPasswordEmailAuthLink(
  data: SupabaseGeneratedLinkData,
  type: SupabaseEmailLinkType
): string {
  const tokenHash = data.properties?.hashed_token

  if (!tokenHash) {
    return data.properties?.action_link ?? getFullUrl("/set-password")
  }

  const url = new URL(getFullUrl("/set-password"))
  url.searchParams.set("token_hash", tokenHash)
  url.searchParams.set("type", type)

  return url.toString()
}
