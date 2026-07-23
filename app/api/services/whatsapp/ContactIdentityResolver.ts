import { normalizePhone } from "./phoneUtils"

export type ResolvedContactIdentity =
  | { kind: "PHONE"; remoteJid: string; phoneE164: string }
  | { kind: "LID"; remoteJid: string; phoneE164: null }
  | { kind: "GROUP"; remoteJid: string; phoneE164: null }
  | { kind: "UNKNOWN"; remoteJid: string; phoneE164: null }

/**
 * Resolves provider identifiers without guessing. In particular, a `@lid`
 * value is not a phone number and may only be linked later by a verified alias
 * or an audited manual action.
 */
export function resolveContactIdentity(remoteJid: string): ResolvedContactIdentity {
  const value = remoteJid.trim().toLowerCase()
  if (value.endsWith("@g.us")) return { kind: "GROUP", remoteJid, phoneE164: null }
  if (value.endsWith("@lid")) return { kind: "LID", remoteJid, phoneE164: null }
  if (value.endsWith("@s.whatsapp.net") || value.endsWith("@c.us")) {
    const raw = value.slice(0, value.indexOf("@"))
    if (!/^\d{8,15}$/.test(raw)) return { kind: "UNKNOWN", remoteJid, phoneE164: null }
    return { kind: "PHONE", remoteJid, phoneE164: `+${normalizePhone(raw)}` }
  }
  return { kind: "UNKNOWN", remoteJid, phoneE164: null }
}

export function formatPhoneE164(phoneE164: string | null | undefined): string | null {
  if (!phoneE164) return null
  const digits = phoneE164.replace(/\D/g, "")
  if (!digits) return null
  // Brazilian display format; other countries retain the unambiguous E.164 form.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4)
    const local = digits.slice(4)
    return local.length === 9
      ? `+55 (${ddd}) ${local.slice(0, 5)}-${local.slice(5)}`
      : `+55 (${ddd}) ${local.slice(0, 4)}-${local.slice(4)}`
  }
  return `+${digits}`
}
