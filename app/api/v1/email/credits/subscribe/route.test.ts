import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"

mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: mock(async () => ({
    access: { profileId: "p1", teamId: "t1", teamMember: { role: "manager" } },
  })),
}))
const subscribeMock = mock(async () => new Output(true, ["ok"], [], { checkoutId: "c1" }))
mock.module("@/app/api/useCases/email/EmailCreditUseCase", () => ({
  EmailCreditUseCase: class {
    subscribe = subscribeMock
  },
}))

const { POST } = await import("./route")

const originalEnv = { ...process.env }

function makeRequest(billingType: string) {
  return new NextRequest("http://localhost/api/v1/email/credits/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "starter", billingType }),
  })
}

describe("POST /email/credits/subscribe — cartão desligado", () => {
  beforeEach(() => {
    subscribeMock.mockClear()
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
    delete process.env.CARD_PAYMENTS_ENABLED
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("CREDIT_CARD -> 422 sem criar checkout", async () => {
    const response = await POST(makeRequest("CREDIT_CARD"))

    expect(response.status).toBe(422)
    expect(subscribeMock).not.toHaveBeenCalled()
  })

  it("PIX passa", async () => {
    const response = await POST(makeRequest("PIX"))

    expect(response.status).toBe(201)
    expect(subscribeMock).toHaveBeenCalledTimes(1)
  })

  it("CARD_PAYMENTS_ENABLED=false bloqueia mesmo com a chave pública", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    process.env.CARD_PAYMENTS_ENABLED = "false"

    const response = await POST(makeRequest("CREDIT_CARD"))

    expect(response.status).toBe(422)
  })
})
