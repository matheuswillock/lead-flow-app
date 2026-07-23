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

  it("permite rollout explícito do header sem interromper produção não provisionada", () => {
    const env = process.env as Record<string, string | undefined>
    const prev = env.WHATSAPP_WEBHOOK_HEADER_ENFORCE
    const previousNodeEnv = env.NODE_ENV
    delete env.WHATSAPP_WEBHOOK_HEADER_ENFORCE
    env.NODE_ENV = "development"
    expect(isWebhookHeaderEnforcementEnabled()).toBe(false)
    env.WHATSAPP_WEBHOOK_HEADER_ENFORCE = "true"
    expect(isWebhookHeaderEnforcementEnabled()).toBe(true)
    delete env.WHATSAPP_WEBHOOK_HEADER_ENFORCE
    env.NODE_ENV = "production"
    expect(isWebhookHeaderEnforcementEnabled()).toBe(false)
    env.WHATSAPP_WEBHOOK_HEADER_ENFORCE = "true"
    expect(isWebhookHeaderEnforcementEnabled()).toBe(true)
    if (prev) env.WHATSAPP_WEBHOOK_HEADER_ENFORCE = prev
    else delete env.WHATSAPP_WEBHOOK_HEADER_ENFORCE
    if (previousNodeEnv) env.NODE_ENV = previousNodeEnv
    else delete env.NODE_ENV
  })

  it("rejeita pepper configurado que não é forte", () => {
    const env = process.env as Record<string, string | undefined>
    const nodeEnv = env.NODE_ENV
    const pepper = env.WHATSAPP_WEBHOOK_HEADER_SECRET
    env.WHATSAPP_WEBHOOK_HEADER_SECRET = "curto"
    expect(() => deriveWebhookHeaderSecret("secret")).toThrow("at least 32")
    env.WHATSAPP_WEBHOOK_HEADER_SECRET = "x".repeat(32)
    expect(deriveWebhookHeaderSecret("secret")).toHaveLength(64)
    if (nodeEnv) env.NODE_ENV = nodeEnv
    else delete env.NODE_ENV
    if (pepper) env.WHATSAPP_WEBHOOK_HEADER_SECRET = pepper
    else delete env.WHATSAPP_WEBHOOK_HEADER_SECRET
  })
})
