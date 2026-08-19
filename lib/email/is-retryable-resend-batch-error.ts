export type ResendBatchErrorInfo = {
  statusCode?: number
  message?: string
  name?: string
}

const NON_RETRYABLE_STATUS = new Set([401, 403, 422])

export function isResendMonthlyQuotaExceeded(error: ResendBatchErrorInfo): boolean {
  const name = error.name?.toLowerCase() ?? ""
  if (name === "monthly_quota_exceeded") return true
  const message = error.message?.toLowerCase() ?? ""
  return (
    message.includes("monthly_quota_exceeded") ||
    message.includes("monthly email sending quota")
  )
}

/**
 * Erros transientes do Resend batch podem ser re-tentados com nova idempotency key.
 * 403 (domínio não verificado), 422 (validação) e cota mensal são falhas definitivas.
 * 429 de rate limit continua retryável; 429 de cota mensal não se recupera em segundos.
 */
export function isRetryableResendBatchError(error: ResendBatchErrorInfo): boolean {
  if (isResendMonthlyQuotaExceeded(error)) {
    return false
  }
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
