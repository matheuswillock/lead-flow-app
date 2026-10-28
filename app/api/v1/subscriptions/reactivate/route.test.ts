import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"

const reactivateMock = mock(async () => new Output(true, ["ok"], [], { subscriptionId: "sub_new" }))
mock.module("@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase", () => ({
  subscriptionUpgradeUseCase: { reactivateSubscription: reactivateMock },
}))
mock.module("@/app/api/v1/utils/requireActiveAccountAccess", () => ({
  requireActiveAccountAccess: mock(async () => null),
}))

const { POST } = await import("./route")
const { stubCardEnabledConfig } = await import("@/test/support/card-enabled-config")

const originalEnv = { ...process.env }

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/subscriptions/reactivate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-supabase-user-id": "sb-1" },
    body: JSON.stringify(body),
  })
}

const CARD_BODY = {
  operatorCount: 1,
  paymentMethod: "CREDIT_CARD",
  creditCard: { number: "4111" },
  creditCardHolderInfo: { name: "A" },
}

describe("POST /subscriptions/reactivate — cartão desligado", () => {
  beforeEach(() => {
    reactivateMock.mockClear()
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
    delete process.env.CARD_PAYMENTS_ENABLED
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("CREDIT_CARD -> 422 e a assinatura antiga não é cancelada", async () => {
    const response = await POST(makeRequest(CARD_BODY))

    expect(response.status).toBe(422)
    expect(reactivateMock).not.toHaveBeenCalled()
  })

  it("CARD_PAYMENTS_ENABLED=false bloqueia mesmo com a chave pública", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    process.env.CARD_PAYMENTS_ENABLED = "false"

    const response = await POST(makeRequest(CARD_BODY))

    expect(response.status).toBe(422)
    expect(reactivateMock).not.toHaveBeenCalled()
  })

  it("PIX sempre passa", async () => {
    const response = await POST(makeRequest({ operatorCount: 1, paymentMethod: "PIX" }))

    expect(response.status).toBe(201)
    expect(reactivateMock).toHaveBeenCalledTimes(1)
  })

  it("a chave pública sozinha não libera o cartão: a flag do backoffice também precisa estar ligada", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    const restore = stubCardEnabledConfig(false)
    try {
      const response = await POST(makeRequest(CARD_BODY))

      expect(response.status).toBe(422)
      expect(reactivateMock).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it("cartão liberado passa", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    const restore = stubCardEnabledConfig(true)
    try {
      const response = await POST(makeRequest(CARD_BODY))

      expect(response.status).toBe(201)
    } finally {
      restore()
    }
  })
})
