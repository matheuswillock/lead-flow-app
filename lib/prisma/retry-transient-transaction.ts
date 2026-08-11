import { Prisma } from "@prisma/client"

/** Transaction start timeout — retryable within the import cron deadline. */
const TRANSIENT_TRANSACTION_ERROR_CODES = new Set(["P2028"])

const DEFAULT_MAX_ATTEMPTS = 3
/** Production backoff between attempts: 250ms, then 500ms (spec Ticket 1). */
const DEFAULT_BACKOFF_MS = [250, 500] as const

export function isTransientTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_TRANSACTION_ERROR_CODES.has(error.code)
  }
  const code = (error as { code?: string } | null)?.code
  return typeof code === "string" && TRANSIENT_TRANSACTION_ERROR_CODES.has(code)
}

export function formatTransientTransactionErrorMessage(
  error: unknown,
  context = "Erro ao processar jobs de importação"
): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `${context}: ${error.code} — ${error.message}`
  }
  if (error instanceof Error) {
    const code = (error as { code?: string }).code
    return code ? `${context}: ${code} — ${error.message}` : `${context}: ${error.message}`
  }
  return context
}

export type WithTransientTransactionRetryOptions = {
  /** Total attempts including the first (default 3). */
  maxAttempts?: number
  /** Delay in ms before each retry (index 0 = after 1st failure). */
  backoffMs?: readonly number[]
  label?: string
  sleep?: (ms: number) => Promise<void>
}

/**
 * Retries an operation on transient Prisma transaction start errors (P2028).
 * Non-transient errors propagate immediately.
 */
export async function withTransientTransactionRetry<T>(
  operation: () => Promise<T>,
  options?: WithTransientTransactionRetryOptions
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const backoffMs = options?.backoffMs ?? DEFAULT_BACKOFF_MS
  const sleep =
    options?.sleep ??
    (process.env.NODE_ENV === "test"
      ? async () => undefined
      : (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const label = options?.label ? ` ${options.label}` : ""

  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const hasRetriesLeft = attempt < maxAttempts - 1

      if (!isTransientTransactionError(error) || !hasRetriesLeft) {
        throw error
      }

      const code =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : (error as { code?: string } | null)?.code
      const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)] ?? 250

      console.warn(
        `[prisma] Transient transaction error${label} (${code}). Retrying (${attempt + 1}/${maxAttempts - 1}) after ${delay}ms...`
      )
      await sleep(delay)
    }
  }

  throw lastError
}
