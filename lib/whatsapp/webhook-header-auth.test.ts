import { describe, expect, it } from "bun:test"
import {
  deriveWebhookHeaderSecret,
  extractWebhookSecretFromUrl,
  isWebhookHeaderEnforcementEnabled,
  WHATSAPP_WEBHOOK_HEADER_NAME,
} from "./webhook-header-auth"

describe("webhook-header-auth", () => {
  it("deriva segredo determinístico", () => {
    expect(deriveWebhookHeaderSecret("x")).toBe(deriveWebhookHeaderSecret("x"))
  })

  it("extrai secret da URL do webhook Evolution", () => {
    expect(
      extractWebhookSecretFromUrl(
        "https://app.example.com/api/webhooks/whatsapp/evolution/abc123secret"
      )
    ).toBe("abc123secret")
    expect(extractWebhookSecretFromUrl("https://app.example.com/other")).toBeNull()
  })

  it("header canônico é apikey", () => {
    expect(WHATSAPP_WEBHOOK_HEADER_NAME).toBe("apikey")
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
