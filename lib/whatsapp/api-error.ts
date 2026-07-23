export type WhatsAppApiErrorCode =
  | "ACCESS_DENIED"
  | "VALIDATION_ERROR"
  | "CONVERSATION_NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "PROVIDER_OFFLINE"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "DELIVERY_UNKNOWN"
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
