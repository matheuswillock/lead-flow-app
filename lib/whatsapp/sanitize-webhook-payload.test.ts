import { describe, expect, test } from "bun:test"
import { sanitizeWhatsAppWebhookPayload } from "./sanitize-webhook-payload"

describe("sanitizeWhatsAppWebhookPayload", () => {
  test("keeps webhook data required for processing while removing secrets and inline media", () => {
    expect(sanitizeWhatsAppWebhookPayload({
      event: "MESSAGES_UPSERT",
      data: { key: { id: "message-1" }, base64: "large-media" },
      token: "secret-token",
      nested: { authorization: "Bearer secret", keep: true },
    })).toEqual({
      event: "MESSAGES_UPSERT",
      data: { key: { id: "message-1" } },
      nested: { keep: true },
    })
  })
})
