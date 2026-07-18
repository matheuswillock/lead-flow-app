const SENSITIVE_KEYS = new Set(["base64", "qrcode", "qr", "token", "secret", "apikey", "authorization"])

/** Removes credentials and large inline media before a webhook is persisted. */
export function sanitizeWhatsAppWebhookPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeWhatsAppWebhookPayload)
  if (!value || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
      const normalized = key.toLowerCase()
      if (SENSITIVE_KEYS.has(normalized) || normalized.includes("base64") || normalized.includes("secret")) {
        return []
      }
      return [[key, sanitizeWhatsAppWebhookPayload(nested)]]
    })
  )
}
