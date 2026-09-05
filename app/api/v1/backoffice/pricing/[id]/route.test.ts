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

const updateMock = mock(async () => new Output(true, ["Produto atualizado"], [], { id: "product-1" }))
const deleteMock = mock(async () => new Output(true, ["Produto removido"], [], null))

mock.module("@/app/api/useCases/backofficeProduct/BackofficeProductUseCase", () => ({
  backofficeProductUseCase: {
    update: updateMock,
    delete: deleteMock,
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

const { PUT, DELETE } = await import("./route")

const params = Promise.resolve({ id: "product-1" })

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/v1/backoffice/pricing/product-1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
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
  updateMock.mockClear()
  deleteMock.mockClear()
  consumeBillingRateLimitMock.mockReset()
  consumeBillingRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })
  grantManagerAccess()
})

describe("PUT/DELETE /backoffice/pricing/[id] — S2/DA2 rate limit", () => {
  it("PUT acima do teto → 429, use case não invocado", async () => {
    consumeBillingRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 5 })

    const response = await PUT(makeRequest("PUT", { name: "Novo nome" }), { params })

    expect(response.status).toBe(429)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("PUT abaixo do teto → fluxo intocado", async () => {
    const response = await PUT(makeRequest("PUT", { name: "Novo nome" }), { params })

    expect(response.status).toBe(200)
    expect(updateMock).toHaveBeenCalled()
  })

  it("DELETE acima do teto → 429, use case não invocado", async () => {
    consumeBillingRateLimitMock.mockResolvedValue({ allowed: false, retryAfterSeconds: 5 })

    const response = await DELETE(makeRequest("DELETE"), { params })

    expect(response.status).toBe(429)
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it("DELETE abaixo do teto → fluxo intocado", async () => {
    const response = await DELETE(makeRequest("DELETE"), { params })

    expect(response.status).toBe(200)
    expect(deleteMock).toHaveBeenCalled()
  })
})
