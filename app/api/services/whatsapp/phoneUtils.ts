import { randomBytes } from "crypto"

/**
 * Normalizes a phone string to digits only (E.164 without +).
 * Examples: "(11) 99999-9999" → "5511999999999", "+55 11 99999-9999" → "5511999999999"
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")

  if (digits.startsWith("55") && digits.length >= 12) {
    return digits
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

export type WhatsAppChatKind = "individual" | "group" | "lid" | "unknown"

export function getChatKind(externalChatId: string | null | undefined): WhatsAppChatKind {
  if (!externalChatId) return "unknown"
  if (externalChatId.endsWith("@g.us")) return "group"
  if (externalChatId.endsWith("@lid")) return "lid"
  if (externalChatId.endsWith("@s.whatsapp.net")) return "individual"
  return "unknown"
}

export function isGroupChat(externalChatId: string | null | undefined): boolean {
  return getChatKind(externalChatId) === "group"
}

/**
 * Extracts the opaque identifier from a WhatsApp JID (digits before @suffix).
 */
export function extractOpaqueId(remoteJid: string): string {
  const atIndex = remoteJid.indexOf("@")
  if (atIndex === -1) {
    return remoteJid.replace(/\D/g, "") || remoteJid
  }
  return remoteJid.slice(0, atIndex)
}

/**
 * Strips WhatsApp JID suffixes from remoteJid or owner values.
 * Preserves @lid identifiers as opaque local ids.
 */
export function normalizeRemoteJid(remoteJid: string): string {
  if (remoteJid.endsWith("@lid")) {
    return remoteJid.replace(/@lid$/, "")
  }
  return remoteJid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "")
}

export function resolveNormalizedPhone(remoteJid: string, phoneRaw: string): string {
  const kind = getChatKind(remoteJid)
  if (kind === "group" || kind === "lid") {
    return phoneRaw
  }
  return normalizePhone(phoneRaw)
}

/**
 * Builds a WhatsApp individual chat JID from a normalized phone number.
 */
export function toWhatsAppJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`
}

/**
 * Returns "YYYY-MM" for the given date (defaults to current date).
 * Example: "2026-06"
 */
export function buildPeriodKey(date?: Date): string {
  const d = date ?? new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

/**
 * Returns a cryptographically random 32-character hex string to use as webhook secret.
 */
export function generateWebhookSecret(): string {
  return randomBytes(16).toString("hex")
}
