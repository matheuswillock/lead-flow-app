export type PaymentProviderErrorCode =
  | "CONFIGURATION_INVALID"
  | "VALIDATION_FAILED"
  | "AUTHENTICATION_FAILED"
  | "REMOTE_REQUEST_FAILED"
  | "REMOTE_TIMEOUT"
  | "UNKNOWN_RESULT"
  | "UNSUPPORTED_OPERATION"
  | "WEBHOOK_INVALID"

export class PaymentProviderError extends Error {
  constructor(
    readonly code: PaymentProviderErrorCode,
    message: string,
    readonly retryable = false,
    readonly remoteStatus?: number,
    readonly remoteCode?: string,
  ) {
    super(message)
    this.name = "PaymentProviderError"
  }
}

export function sanitizeProviderError(error: unknown): PaymentProviderError {
  if (error instanceof PaymentProviderError) return error
  return new PaymentProviderError(
    "REMOTE_REQUEST_FAILED",
    "Falha ao comunicar com o provedor de pagamento",
  )
}
