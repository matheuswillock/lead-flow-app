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

const listMock = mock(async () => new Output(true, [], [], []))
const createMock = mock(async () => new Output(true, ["Produto criado"], [], { id: "product-1" }))

mock.module("@/app/api/useCases/backofficeProduct/BackofficeProductUseCase", () => ({
  backofficeProductUseCase: {
    list: listMock,
    create: createMock,
  },
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
  return new NextRequest("http://localhost/api/v1/backoffice/pricing", {
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

beforeEach(() => {
  createMock.mockClear()
  consumeBillingRateLimitMock.mockReset()
  consumeBillingRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })
  grantManagerAccess()
})

describe("POST /backoffice/pricing — S2/DA2 rate limit por backofficeUserId", () => {
  it("acima do teto → 429 com Retry-After, use case não invocado", async () => {
    consumeBillingRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 })

    const response = await POST(makeRequest({ name: "Produto X" }))

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("9")
    expect(createMock).not.toHaveBeenCalled()
  })

  it("abaixo do teto → fluxo intocado", async () => {
    const response = await POST(makeRequest({ name: "Produto X" }))

    expect(response.status).toBe(201)
    expect(createMock).toHaveBeenCalled()
  })
})
