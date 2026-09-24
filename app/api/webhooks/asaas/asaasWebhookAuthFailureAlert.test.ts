import { beforeEach, describe, expect, it, mock } from "bun:test"

const captureMessageMock = mock((_message: string, _context?: Record<string, unknown>) => "")
const consumeBillingRateLimitMock = mock(
  async (_key: string, _options: { limit: number; windowMs: number }) => ({
    allowed: true,
    retryAfterSeconds: 1,
  })
)

mock.module("@sentry/nextjs", () => ({ captureMessage: captureMessageMock }))
// Mock completo (não parcial) de @/lib/billing/billing-rate-limit — um
// mock.module parcial contaminaria route.test.ts quando os dois arquivos
// rodam no mesmo processo (BILLING_RATE_LIMIT_DEFAULTS ficaria undefined
// lá). Mesmo shape usado em route.test.ts.
mock.module("@/lib/billing/billing-rate-limit", () => ({
  consumeBillingRateLimit: consumeBillingRateLimitMock,
  BILLING_RATE_LIMIT_DEFAULTS: {
    webhookInvalidToken: { limit: 30, windowMs: 5 * 60_000 },
    checkoutCreate: { limit: 10, windowMs: 60_000 },
    backofficePricing: { limit: 20, windowMs: 60_000 },
  },
}))

const {
  reportAsaasWebhookAuthRejected,
  maskAsaasWebhookToken,
  getAsaasWebhookAuthFailureEscalationThreshold,
} = await import("./asaasWebhookAuthFailureAlert")

describe("maskAsaasWebhookToken", () => {
  it("mascara preservando só os 4 primeiros e 4 últimos caracteres", () => {
    expect(maskAsaasWebhookToken("aact_prod_abcdefghijklmnop")).toBe("aact…mnop")
  })

  it("token ausente vira '(ausente)'", () => {
    expect(maskAsaasWebhookToken(null)).toBe("(ausente)")
    expect(maskAsaasWebhookToken(undefined)).toBe("(ausente)")
  })

  it("token curto (<=8 chars) vira '***' em vez de revelar tudo mascarando 0 caracteres", () => {
    expect(maskAsaasWebhookToken("abc123")).toBe("***")
  })
})

describe("reportAsaasWebhookAuthRejected (T-30.24 — E7/X3/C36)", () => {
  beforeEach(() => {
    captureMessageMock.mockClear()
    consumeBillingRateLimitMock.mockClear()
    consumeBillingRateLimitMock.mockImplementation(async () => ({
      allowed: true,
      retryAfterSeconds: 1,
    }))
  })

  it("abaixo do limiar: captureMessage com tags {route, phase} e level warning, sem 'escalated'", async () => {
    const result = await reportAsaasWebhookAuthRejected({
      reason: "missing_token",
      receivedToken: null,
    })

    expect(result.escalated).toBe(false)
    expect(captureMessageMock).toHaveBeenCalledTimes(1)
    const [, context] = captureMessageMock.mock.calls[0] as [
      string,
      { level: string; tags: Record<string, string> },
    ]
    expect(context.level).toBe("warning")
    expect(context.tags).toEqual({ route: "AsaasWebhookRoute", phase: "auth-rejected" })
  })

  it("acima do limiar (N 401 na mesma janela): escala para level fatal com tag escalated=true", async () => {
    consumeBillingRateLimitMock.mockImplementation(async () => ({
      allowed: false,
      retryAfterSeconds: 3600,
    }))

    const result = await reportAsaasWebhookAuthRejected({
      reason: "invalid_token",
      receivedToken: "wrong-token-value",
    })

    expect(result.escalated).toBe(true)
    const [, context] = captureMessageMock.mock.calls[0] as [
      string,
      { level: string; tags: Record<string, string> },
    ]
    expect(context.level).toBe("fatal")
    expect(context.tags).toEqual({
      route: "AsaasWebhookRoute",
      phase: "auth-rejected",
      escalated: "true",
    })
  })

  it("usa a chave e a janela horária dedicadas — não a mesma chave do rate limit por IP", async () => {
    await reportAsaasWebhookAuthRejected({ reason: "missing_token", receivedToken: null })

    expect(consumeBillingRateLimitMock).toHaveBeenCalledWith(
      "asaas-webhook-auth-failure-escalation",
      expect.objectContaining({ windowMs: 60 * 60_000 })
    )
  })

  it("carrega o token mascarado em extra, nunca o valor completo", async () => {
    await reportAsaasWebhookAuthRejected({
      reason: "invalid_token",
      receivedToken: "aact_prod_supersecretvalue",
    })

    const [, context] = captureMessageMock.mock.calls[0] as [string, { extra: { maskedToken: string } }]
    expect(context.extra.maskedToken).toBe("aact…alue")
    expect(context.extra.maskedToken).not.toContain("supersecret")
  })
})

describe("getAsaasWebhookAuthFailureEscalationThreshold", () => {
  it("default é 5 quando a env não está setada", () => {
    delete process.env.ASAAS_WEBHOOK_AUTH_FAILURE_ESCALATION_THRESHOLD
    expect(getAsaasWebhookAuthFailureEscalationThreshold()).toBe(5)
  })

  it("respeita a env quando setada com um inteiro válido", () => {
    process.env.ASAAS_WEBHOOK_AUTH_FAILURE_ESCALATION_THRESHOLD = "10"
    expect(getAsaasWebhookAuthFailureEscalationThreshold()).toBe(10)
    delete process.env.ASAAS_WEBHOOK_AUTH_FAILURE_ESCALATION_THRESHOLD
  })
})
