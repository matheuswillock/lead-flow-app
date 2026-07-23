/**
 * WhatsApp provider failures routinely contain raw HTTP bodies.  Keep those
 * bodies out of application logs: they may contain a JID, phone, signed media
 * URL or provider secret.  Callers can still correlate the safe event ID with
 * their request trace without retaining the payload.
 */
export function getWhatsAppCorrelationId(): string {
  return crypto.randomUUID()
}

export function toWhatsAppSafeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === "string" && /^[A-Z0-9_:-]{2,80}$/.test(code)) return code
  }
  if (error instanceof DOMException && error.name === "TimeoutError") return "provider_timeout"
  if (error instanceof Error && /abort|timeout/i.test(error.name + error.message)) return "provider_timeout"
  return "provider_request_failed"
}

export const safeWhatsAppErrorCode = toWhatsAppSafeErrorCode

export function logWhatsAppProviderFailure(input: {
  operation: string
  correlationId: string
  status?: number
  error?: unknown
}): void {
  console.error("[WhatsAppProvider] request failed", {
    operation: input.operation,
    correlationId: input.correlationId,
    ...(input.status ? { status: input.status } : {}),
    code: toWhatsAppSafeErrorCode(input.error),
  })
}

export function logSafeWhatsAppError(scope: string, error: unknown, correlationId = crypto.randomUUID()): string {
  console.error(scope, {
    code: safeWhatsAppErrorCode(error),
    correlationId,
  })
  return correlationId
}
