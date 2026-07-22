const DEADLOCK_CODE = "40P01"
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 40

export function isDeadlockError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  const withCode = error as { code?: unknown; message?: unknown; meta?: { code?: unknown } }
  if (withCode.code === DEADLOCK_CODE || withCode.meta?.code === DEADLOCK_CODE) {
    return true
  }

  const message =
    typeof withCode.message === "string"
      ? withCode.message
      : error instanceof Error
        ? error.message
        : String(error)

  return message.includes("deadlock detected") || message.includes(DEADLOCK_CODE)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withDeadlockRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxAttempts?: number
    baseDelayMs?: number
    onRetry?: (attempt: number, error: unknown) => void
  }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (!isDeadlockError(error) || attempt >= maxAttempts) {
        throw error
      }
      options?.onRetry?.(attempt, error)
      const jitter = Math.floor(Math.random() * baseDelayMs)
      await sleep(baseDelayMs * attempt + jitter)
    }
  }

  throw new Error("withDeadlockRetry: unreachable")
}
