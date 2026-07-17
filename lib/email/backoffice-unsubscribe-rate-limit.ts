const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX_ATTEMPTS = 5

type RateLimitState = {
  count: number
  resetAt: number
}

const unsubscribeAttempts = new Map<string, RateLimitState>()

export const BACKOFFICE_UNSUBSCRIBE_RATE_LIMIT_MESSAGE =
  "Muitas tentativas. Aguarde alguns minutos e tente novamente."

export function checkAndRegisterBackofficeUnsubscribeRateLimit(ip: string): {
  allowed: boolean
  remaining: number
} {
  const now = Date.now()
  const current = unsubscribeAttempts.get(ip)

  if (!current || now >= current.resetAt) {
    unsubscribeAttempts.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - 1 }
  }

  if (current.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 }
  }

  current.count += 1
  unsubscribeAttempts.set(ip, current)
  return { allowed: true, remaining: RATE_LIMIT_MAX_ATTEMPTS - current.count }
}
