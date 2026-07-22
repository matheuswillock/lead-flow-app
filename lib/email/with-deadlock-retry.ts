const POSTGRES_DEADLOCK_CODE = "40P01"
/** Prisma wraps transaction conflicts/deadlocks as P2034 (Prisma 6+). */
const PRISMA_TRANSACTION_CONFLICT_CODE = "P2034"
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 40

export function isDeadlockError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  const withCode = error as { code?: unknown; message?: unknown; meta?: { code?: unknown } }
  if (
    withCode.code === POSTGRES_DEADLOCK_CODE ||
    withCode.code === PRISMA_TRANSACTION_CONFLICT_CODE ||
    withCode.meta?.code === POSTGRES_DEADLOCK_CODE ||
    withCode.meta?.code === PRISMA_TRANSACTION_CONFLICT_CODE
  ) {
    return true
  }

  const message =
    typeof withCode.message === "string"
      ? withCode.message
      : error instanceof Error
        ? error.message
        : String(error)

  return (
    message.includes("deadlock detected") ||
    message.includes(POSTGRES_DEADLOCK_CODE) ||
    message.includes(PRISMA_TRANSACTION_CONFLICT_CODE) ||
    message.includes("Transaction failed due to a write conflict")
  )
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
