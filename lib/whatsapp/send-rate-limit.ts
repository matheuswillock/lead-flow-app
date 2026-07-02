const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30

const windows = new Map<string, { count: number; resetAt: number }>()

export function isWithinSendRateLimit(teamId: string): boolean {
  const now = Date.now()
  const entry = windows.get(teamId)

  if (!entry || now >= entry.resetAt) {
    windows.set(teamId, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (entry.count >= MAX_PER_WINDOW) return false

  entry.count++
  return true
}
