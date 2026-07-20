const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000] as const

export const WHATSAPP_WEBHOOK_MAX_ATTEMPTS = RETRY_DELAYS_MS.length
export const WHATSAPP_WEBHOOK_PROCESSING_TIMEOUT_MS = 5 * 60_000

export function getWhatsAppWebhookRetryAt(attemptCount: number, now = new Date()): Date | null {
  const delay = RETRY_DELAYS_MS[attemptCount - 1]
  return delay === undefined ? null : new Date(now.getTime() + delay)
}
