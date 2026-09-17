import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse, after } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  after,
  connection: mock(async () => undefined),
}))
mock.module("server-only", () => ({}))

type BackofficeAccessResult =
  | { access: Record<string, unknown>; error?: never; status?: never }
  | { access?: never; error: Output; status: number }

let accessResult: BackofficeAccessResult

mock.module("@/app/api/v1/backoffice/utils/getBackofficeAccess", () => ({
  getBackofficeAccess: mock(async () => accessResult),
}))

const createMock = mock(async () => new Output(true, ["Ordem criada"], [], { id: "order-1" }))

mock.module("@/app/api/useCases/backoffice/BackofficeSubscriptionChangeOrderUseCase", () => ({
  backofficeSubscriptionChangeOrderUseCase: { create: createMock },
}))

const consumeBillingRateLimitMock = mock(async () => ({ allowed: true, retryAfterSeconds: 1 }))

mock.module("@/lib/billing/billing-rate-limit", () => ({
  consumeBillingRateLimit: consumeBillingRateLimitMock,
  BILLING_RATE_LIMIT_DEFAULTS: {
    webhookInvalidToken: { limit: 30, windowMs: 5 * 60_000 },
    checkoutCreate: { limit: 10, windowMs: 60_000 },
    backofficePricing: { limit: 20, windowMs: 60_000 },
  },
}))

const { POST } = await import("./route")

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/backoffice/subscription-change-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function grantManagerAccess() {
  accessResult = {
    access: {
      supabaseId: "supa-1",
      profileId: "bo-profile-1",
      backofficeUserId: "bo-1",
      backofficeEmail: "dono@corretorstudio.com",
      fullAccess: true,
      isOperator: false,
    },
  }
}

function grantOperatorAccess() {
  accessResult = {
    access: {
      supabaseId: "supa-2",
      profileId: "bo-profile-2",
      backofficeUserId: "bo-2",
      backofficeEmail: "operador@corretorstudio.com",
      fullAccess: false,
      isOperator: true,
    },
  }
}

beforeEach(() => {
  createMock.mockClear()
  consumeBillingRateLimitMock.mockReset()
  consumeBillingRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })
  grantManagerAccess()
})

const VALID_BODY = {
  masterProfileId: "11111111-1111-4111-8111-111111111111",
  targetProductId: "22222222-2222-4222-8222-222222222222",
  targetCycle: "monthly",
}

describe("POST /backoffice/subscription-change-orders — S1 aplicada por construção", () => {
  it("operador sem fullAccess → 403, use case não invocado", async () => {
    grantOperatorAccess()

    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(403)
    expect(createMock).not.toHaveBeenCalled()
  })

  it("manager → 200/201, use case invocado com o actor certo", async () => {
    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(201)
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        masterProfileId: VALID_BODY.masterProfileId,
        targetProductId: VALID_BODY.targetProductId,
        targetCycle: "monthly",
        overrideAmount: null,
        actorProfileId: "bo-profile-1",
        backofficeUserId: "bo-1",
      })
    )
  })
})

describe("POST /backoffice/subscription-change-orders — rate limit do E2 no preço avulso", () => {
  it("sem overrideAmount → limiter não é consultado", async () => {
    await POST(makeRequest(VALID_BODY))

    expect(consumeBillingRateLimitMock).not.toHaveBeenCalled()
  })

  it("com overrideAmount acima do teto de rate limit → 429, use case não invocado", async () => {
    consumeBillingRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 8 })

    const response = await POST(makeRequest({ ...VALID_BODY, overrideAmount: 150 }))

    expect(response.status).toBe(429)
    expect(createMock).not.toHaveBeenCalled()
  })

  it("com overrideAmount dentro do teto → segue e chama o use case", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, overrideAmount: 150 }))

    expect(response.status).toBe(201)
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ overrideAmount: 150 }))
  })
})
