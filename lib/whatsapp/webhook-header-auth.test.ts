import { describe, expect, it } from "bun:test"
import { deriveWebhookHeaderSecret, isWebhookHeaderEnforcementEnabled } from "./webhook-header-auth"

describe("webhook-header-auth", () => {
  it("deriva segredo determinístico", () => {
    expect(deriveWebhookHeaderSecret("x")).toBe(deriveWebhookHeaderSecret("x"))
  })
  it("enforcement opt-in (default false)", () => {
    const prev = process.env.WHATSAPP_WEBHOOK_HEADER_ENFORCE
    delete process.env.WHATSAPP_WEBHOOK_HEADER_ENFORCE
    expect(isWebhookHeaderEnforcementEnabled()).toBe(false)
    process.env.WHATSAPP_WEBHOOK_HEADER_ENFORCE = "true"
    expect(isWebhookHeaderEnforcementEnabled()).toBe(true)
    if (prev) process.env.WHATSAPP_WEBHOOK_HEADER_ENFORCE = prev
    else delete process.env.WHATSAPP_WEBHOOK_HEADER_ENFORCE
  })
})
