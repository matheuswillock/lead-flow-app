import { describe, expect, test } from "bun:test"
import { sanitizeWebhookPayload } from "./sanitize-webhook-payload"

describe("sanitizeWebhookPayload", () => {
  test("keeps webhook data required for processing while removing secrets and inline media", () => {
    expect(sanitizeWebhookPayload({
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

  test("removes credentials from arrays of objects", () => {
    expect(sanitizeWebhookPayload([
      { id: "1", apikey: "should-not-leak" },
      { id: "2", clientSecret: "should-not-leak" },
    ])).toEqual([{ id: "1" }, { id: "2" }])
  })

  test("leaves primitives untouched", () => {
    expect(sanitizeWebhookPayload("plain")).toBe("plain")
    expect(sanitizeWebhookPayload(42)).toBe(42)
    expect(sanitizeWebhookPayload(null)).toBe(null)
  })
})
