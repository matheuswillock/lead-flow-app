export type WhatsAppV3Flag = "send" | "contacts" | "search" | "sync"

const ENV_BY_FLAG: Record<WhatsAppV3Flag, string> = {
  send: "WHATSAPP_V3_SEND_TEAM_IDS",
  contacts: "WHATSAPP_V3_CONTACTS_TEAM_IDS",
  search: "WHATSAPP_V3_SEARCH_TEAM_IDS",
  sync: "WHATSAPP_V3_SYNC_TEAM_IDS",
}

export function isWhatsAppV3Enabled(flag: WhatsAppV3Flag, teamId: string): boolean {
  const configured = process.env[ENV_BY_FLAG[flag]]?.trim()
  if (!configured) return process.env.NODE_ENV !== "production"
  return configured.split(",").map((value) => value.trim()).includes("*")
    || configured.split(",").map((value) => value.trim()).includes(teamId)
}
