import { describe, expect, it } from "bun:test"
import { deriveWebhookHeaderSecret, isWebhookHeaderEnforcementEnabled } from "./webhook-header-auth"

describe("webhook-header-auth", () => {
  it("deriva segredo determinístico", () => {
    expect(deriveWebhookHeaderSecret("x")).toBe(deriveWebhookHeaderSecret("x"))
  })
  it("enforcement default true", () => {
    const prev = process.env.WHATSAPP_WEBHOOK_HEADER_ENFORCE
    delete process.env.WHATSAPP_WEBHOOK_HEADER_ENFORCE
    expect(isWebhookHeaderEnforcementEnabled()).toBe(true)
    if (prev) process.env.WHATSAPP_WEBHOOK_HEADER_ENFORCE = prev
  })
})
