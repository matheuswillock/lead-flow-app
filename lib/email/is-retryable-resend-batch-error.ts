export type ResendBatchErrorInfo = {
  statusCode?: number
  message?: string
}

const NON_RETRYABLE_STATUS = new Set([401, 403, 422])

/**
 * Erros transientes do Resend batch podem ser re-tentados com nova idempotency key.
 * 403 (domínio não verificado) e 422 (validação) são falhas definitivas.
 */
export function isRetryableResendBatchError(error: ResendBatchErrorInfo): boolean {
  const statusCode = error.statusCode
  if (statusCode !== undefined && NON_RETRYABLE_STATUS.has(statusCode)) {
    return false
  }
  if (statusCode === 409) {
    const message = error.message?.toLowerCase() ?? ""
    if (message.includes("idempotency")) {
      return true
    }
    return false
  }
  if (statusCode === undefined) {
    return true
  }
  if (statusCode === 429 || statusCode >= 500) {
    return true
  }
  return false
}

export const MAX_BATCH_SEND_ATTEMPTS = 3

export function resendBatchRetryBackoffMs(attempt: number): number {
  if (attempt <= 0) return 0
  if (attempt === 1) return 2000
  return 5000
}
