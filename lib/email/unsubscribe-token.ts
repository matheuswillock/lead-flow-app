import { createHmac, timingSafeEqual } from "crypto"

const TOKEN_SEPARATOR = "."

function getUnsubscribeSecret(): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET
  if (!secret) {
    throw new Error("EMAIL_UNSUBSCRIBE_SECRET não configurado")
  }
  return secret
}

function signPayload(contactId: string, teamId: string): string {
  return createHmac("sha256", getUnsubscribeSecret())
    .update(`${contactId}|${teamId}`)
    .digest("base64url")
}

export function generateEmailUnsubscribeToken(contactId: string, teamId: string): string {
  const signature = signPayload(contactId, teamId)
  const payload = Buffer.from(`${contactId}${TOKEN_SEPARATOR}${teamId}`, "utf8").toString("base64url")
  return `${payload}${TOKEN_SEPARATOR}${signature}`
}

export function parseEmailUnsubscribeToken(
  token: string
): { contactId: string; teamId: string } | null {
  const parts = token.split(TOKEN_SEPARATOR)
  if (parts.length !== 2) return null

  const [encodedPayload, signature] = parts
  if (!encodedPayload || !signature) return null

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8")
    const [contactId, teamId] = decoded.split(TOKEN_SEPARATOR)
    if (!contactId || !teamId) return null

    const expected = signPayload(contactId, teamId)
    const provided = Buffer.from(signature)
    const expectedBuf = Buffer.from(expected)
    if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
      return null
    }

    return { contactId, teamId }
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
