import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const listConfigs = mock(async (_environment: string) => [
  { provider: "ABACATE_PAY", externalAccountContext: "abacate-production" },
])
mock.module("@/app/api/infra/data/repositories/paymentProviderConfig/PaymentProviderConfigRepository", () => ({
  PaymentProviderConfigRepository: class {},
  paymentProviderConfigRepository: { list: listConfigs },
}))

const claim = mock(async (_input: unknown) => ({ kind: "claimed" as const, claimToken: "claim-1" }))
const assertClaimActive = mock(async (_input: unknown) => true)
const markProcessed = mock(async (_input: unknown) => undefined)
const markFailed = mock(async (_input: unknown) => undefined)
mock.module("@/app/api/infra/data/repositories/paymentProviderEvent/PaymentProviderEventInboxRepository", () => ({
  paymentProviderEventInboxRepository: { claim, assertClaimActive, markProcessed, markFailed },
}))

const attempt = {
  id: "attempt-1",
  status: "PENDING",
  provider: "ABACATE_PAY",
  environment: "PRODUCTION",
  externalAccountContext: "abacate-production",
  ownerType: "PLATFORM_PURCHASE",
  ownerId: "purchase-1",
  tenantId: "tenant-1",
}
const findAttemptByExternalId = mock(async (_input: unknown) => attempt)
const applyEventWithClaim = mock(async (_input: unknown) => undefined)
mock.module("@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository", () => ({
  paymentProviderSessionRepository: {
    findAttemptByExternalId,
    findAttemptById: mock(async () => null),
    applyEventWithClaim,
  },
}))

const bind = mock(async (_input: unknown) => undefined)
mock.module("@/app/api/infra/data/repositories/paymentProviderIdentity/PaymentProviderIdentityRepository", () => ({
  paymentProviderIdentityRepository: { bind },
}))

const markPaidOnceForProvider = mock(async (_input: unknown) => undefined)
mock.module("@/app/api/infra/data/repositories/platformPurchase/PlatformPurchaseRepository", () => ({
  platformPurchaseRepository: { markPaidOnceForProvider },
}))

mock.module("@/app/api/infra/data/repositories/billingGracePayment/BillingGracePaymentRepository", () => ({
  billingGracePaymentRepository: {},
}))

const { POST } = await import("./route")

const ENV_KEYS = [
  "PAYMENT_PROVIDER_ENVIRONMENT",
  "ABACATE_PAY_PRODUCTION_API_KEY",
  "ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET",
  "ABACATE_PAY_PRODUCTION_PUBLIC_KEY",
  "ABACATE_PAY_API_KEY",
  "ABACATE_PAY_WEBHOOK_SECRET",
  "ABACATE_PAY_PUBLIC_KEY",
] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
  process.env.ABACATE_PAY_PRODUCTION_API_KEY = "prod-api-key"
  process.env.ABACATE_PAY_PRODUCTION_WEBHOOK_SECRET = "prod-webhook-secret"
  for (const fn of [claim, assertClaimActive, markProcessed, markFailed, findAttemptByExternalId, applyEventWithClaim, bind, markPaidOnceForProvider]) {
    fn.mockClear()
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

function completedPayload(devMode: boolean) {
  return JSON.stringify({
    id: "evt_prod_1",
    event: "transparent.completed",
    devMode,
    data: { transparent: { id: "pix_char_prod_1", status: "PAID", method: "PIX", amount: 6990 } },
  })
}

function webhookRequest(rawBody: string, query: string) {
  return new Request(`https://app.example.com/api/v1/webhooks/payment-provider/abacate${query}`, {
    method: "POST",
    body: rawBody,
  })
}

describe("POST /api/v1/webhooks/payment-provider/abacate em PRODUCTION", () => {
  it("aceita evento de produção (devMode:false) com o webhookSecret correto e baixa a compra", async () => {
    const response = await POST(webhookRequest(completedPayload(false), "?webhookSecret=prod-webhook-secret"))

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ accepted: true, action: "apply" })
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ environment: "PRODUCTION", externalAccountContext: "abacate-production" }))
    expect(markPaidOnceForProvider).toHaveBeenCalledWith({
      id: "purchase-1",
      provider: "ABACATE_PAY",
      externalId: "pix_char_prod_1",
    })
  })

  it("responde 401 quando o webhookSecret está ausente", async () => {
    const response = await POST(webhookRequest(completedPayload(false), ""))

    expect(response.status).toBe(401)
    expect(claim).not.toHaveBeenCalled()
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
  })

  it("responde 401 quando o webhookSecret está errado", async () => {
    const response = await POST(webhookRequest(completedPayload(false), "?webhookSecret=wrong-secret"))

    expect(response.status).toBe(401)
    expect(claim).not.toHaveBeenCalled()
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
  })

  it("rejeita com 401 evento devMode:true em PRODUCTION", async () => {
    const response = await POST(webhookRequest(completedPayload(true), "?webhookSecret=prod-webhook-secret"))

    expect(response.status).toBe(401)
    expect(claim).not.toHaveBeenCalled()
    expect(markPaidOnceForProvider).not.toHaveBeenCalled()
  })
})
