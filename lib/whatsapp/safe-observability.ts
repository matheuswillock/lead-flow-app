/** Provider logs must never contain JIDs, phone numbers, payloads, URLs or keys. */
export function getWhatsAppCorrelationId(): string {
  return crypto.randomUUID()
}

export function toWhatsAppSafeErrorCode(error: unknown): string {
  if (error instanceof DOMException && error.name === "TimeoutError") return "provider_timeout"
  if (error instanceof Error && /abort|timeout/i.test(error.name + error.message)) return "provider_timeout"
  return "provider_request_failed"
}

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
