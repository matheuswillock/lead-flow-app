import { getFullUrl } from "@/lib/utils/app-url"

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
