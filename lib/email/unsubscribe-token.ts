import { createHmac, timingSafeEqual } from "crypto"

const TOKEN_SEPARATOR = "."

export type EmailUnsubscribeTokenPayload = {
  contactId: string
  teamId: string
  campaignId: string | null
}

function getUnsubscribeSecret(): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET
  if (!secret) {
    throw new Error("EMAIL_UNSUBSCRIBE_SECRET não configurado")
  }
  return secret
}

function signPayload(contactId: string, teamId: string, campaignId?: string | null): string {
  const base = campaignId ? `${contactId}|${teamId}|${campaignId}` : `${contactId}|${teamId}`
  return createHmac("sha256", getUnsubscribeSecret()).update(base).digest("base64url")
}

export function generateEmailUnsubscribeToken(
  contactId: string,
  teamId: string,
  campaignId?: string | null
): string {
  const signature = signPayload(contactId, teamId, campaignId)
  const parts = campaignId
    ? `${contactId}${TOKEN_SEPARATOR}${teamId}${TOKEN_SEPARATOR}${campaignId}`
    : `${contactId}${TOKEN_SEPARATOR}${teamId}`
  const payload = Buffer.from(parts, "utf8").toString("base64url")
  return `${payload}${TOKEN_SEPARATOR}${signature}`
}

export function parseEmailUnsubscribeToken(token: string): EmailUnsubscribeTokenPayload | null {
  const parts = token.split(TOKEN_SEPARATOR)
  if (parts.length !== 2) return null

  const [encodedPayload, signature] = parts
  if (!encodedPayload || !signature) return null

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8")
    const decodedParts = decoded.split(TOKEN_SEPARATOR)
    const contactId = decodedParts[0]
    const teamId = decodedParts[1]
    const campaignId = decodedParts[2] ?? null
    if (!contactId || !teamId) return null

    const expected = signPayload(contactId, teamId, campaignId)
    const provided = Buffer.from(signature)
    const expectedBuf = Buffer.from(expected)
    if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
      return null
    }

    return { contactId, teamId, campaignId }
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
