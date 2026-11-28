export const WHATSAPP_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1_000
export const MAX_WHATSAPP_VERIFICATION_ATTEMPTS = 5
export const MAX_WHATSAPP_CODE_REQUESTS_PER_HOUR = 3
const REQUEST_WINDOW_MS = 60 * 60 * 1_000

type WhatsAppChallengeState = {
  expiresAt: Date
  attempts: number
  consumedAt: Date | null
}

export function canRequestWhatsAppCode(sentAt: readonly Date[], now: Date): boolean {
  const windowStart = now.getTime() - REQUEST_WINDOW_MS
  const recentRequestCount = sentAt.filter((date) => {
    const timestamp = date.getTime()
    return Number.isFinite(timestamp) && timestamp > windowStart && timestamp <= now.getTime()
  }).length

  return recentRequestCount < MAX_WHATSAPP_CODE_REQUESTS_PER_HOUR
}

export function isWhatsAppChallengeUsable(
  challenge: WhatsAppChallengeState,
  now: Date,
): boolean {
  return (
    challenge.consumedAt === null &&
    challenge.attempts >= 0 &&
    challenge.attempts < MAX_WHATSAPP_VERIFICATION_ATTEMPTS &&
    challenge.expiresAt.getTime() > now.getTime()
  )
}
