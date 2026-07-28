export type WhatsAppApiErrorCode =
  | "ACCESS_DENIED"
  | "VALIDATION_ERROR"
  | "CONVERSATION_NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "PROVIDER_OFFLINE"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "DELIVERY_UNKNOWN"
  | "MEDIA_TOO_LARGE"
  | "MEDIA_UNSUPPORTED"
  | "MEDIA_PROCESSING"
  | "MEDIA_EXPIRED"
  | "MEDIA_UNAVAILABLE"
  | "CAPABILITY_UNAVAILABLE"
  | "INTERNAL_ERROR"

export type WhatsAppApiErrorResult = {
  code: WhatsAppApiErrorCode
  retryable: boolean
  correlationId: string
}

export function createWhatsAppCorrelationId(): string {
  return crypto.randomUUID()
}

export function whatsappError(
  code: WhatsAppApiErrorCode,
  retryable = false
): WhatsAppApiErrorResult {
  return { code, retryable, correlationId: createWhatsAppCorrelationId() }
}
