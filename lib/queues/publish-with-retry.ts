export const DEFAULT_PUBLISH_RETRY_ATTEMPTS = 3

/** Delays candidatos entre tentativas. Com 3 tentativas, usam-se [0] e [1]. */
export const DEFAULT_PUBLISH_RETRY_BACKOFF_MS: number[] = [200, 500, 1000]

export type PublishWithRetryResult<T> =
  | { ok: true; result: T; attempts: number }
  | { ok: false; error: unknown; attempts: number }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Retry curto de `publish` em filas Vercel Queue.
 * Não lança: quem chama decide o fallback (ex.: gravar no outbox).
 */
export async function publishWithRetry<T>(
  publish: () => Promise<T>,
  options?: { attempts?: number; backoffMs?: number[] }
): Promise<PublishWithRetryResult<T>> {
  const maxAttempts = options?.attempts ?? DEFAULT_PUBLISH_RETRY_ATTEMPTS
  const backoffMs = options?.backoffMs ?? DEFAULT_PUBLISH_RETRY_BACKOFF_MS

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await publish()
      return { ok: true, result, attempts: attempt }
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) {
        break
      }
      const delay =
        backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 200
      await sleep(delay)
    }
  }

  return { ok: false, error: lastError, attempts: maxAttempts }
}
