import { describe, expect, test } from "bun:test"
import { getWhatsAppWebhookRetryAt, WHATSAPP_WEBHOOK_MAX_ATTEMPTS } from "./whatsappWebhookRetry"

describe("getWhatsAppWebhookRetryAt", () => {
  test("agenda backoff progressivo e encerra após o limite", () => {
    const now = new Date("2026-07-20T00:00:00.000Z")
    expect(getWhatsAppWebhookRetryAt(1, now)?.toISOString()).toBe("2026-07-20T00:01:00.000Z")
    expect(getWhatsAppWebhookRetryAt(3, now)?.toISOString()).toBe("2026-07-20T00:15:00.000Z")
    expect(getWhatsAppWebhookRetryAt(WHATSAPP_WEBHOOK_MAX_ATTEMPTS + 1, now)).toBeNull()
  })
})
