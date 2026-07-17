import { createHmac, timingSafeEqual } from "crypto"

const TOKEN_SEPARATOR = "."

function getBackofficeUnsubscribeSecret(): string {
  const secret = process.env.BACKOFFICE_EMAIL_UNSUBSCRIBE_SECRET
  if (!secret) {
    throw new Error("BACKOFFICE_EMAIL_UNSUBSCRIBE_SECRET não configurado")
  }
  return secret
}

function signPayload(contactId: string, campaignId: string): string {
  return createHmac("sha256", getBackofficeUnsubscribeSecret())
    .update(`${contactId}|${campaignId}`)
    .digest("base64url")
}

export function generateBackofficeEmailUnsubscribeToken(contactId: string, campaignId: string): string {
  const signature = signPayload(contactId, campaignId)
  const payload = Buffer.from(`${contactId}${TOKEN_SEPARATOR}${campaignId}`, "utf8").toString(
    "base64url"
  )
  return `${payload}${TOKEN_SEPARATOR}${signature}`
}

export function parseBackofficeEmailUnsubscribeToken(
  token: string
): { contactId: string; campaignId: string } | null {
  const parts = token.split(TOKEN_SEPARATOR)
  if (parts.length !== 2) return null

  const [encodedPayload, signature] = parts
  if (!encodedPayload || !signature) return null

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8")
    const [contactId, campaignId] = decoded.split(TOKEN_SEPARATOR)
    if (!contactId || !campaignId) return null

    const expected = signPayload(contactId, campaignId)
    const provided = Buffer.from(signature)
    const expectedBuf = Buffer.from(expected)
    if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
      return null
    }

    return { contactId, campaignId }
  } catch {
    return null
  }
}

export function maskEmailForUnsubscribe(email: string): string {
  const [local, domain] = email.split("@")
  if (!local || !domain) return "•••@•••"
  const visible = local.slice(0, 1)
  return `${visible}•••@${domain}`
}
