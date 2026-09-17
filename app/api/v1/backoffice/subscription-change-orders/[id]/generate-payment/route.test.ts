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

const generatePaymentMock = mock(async () => new Output(true, ["Cobrança gerada e e-mail enviado"], [], { id: "order-1" }))

mock.module("@/app/api/useCases/backoffice/BackofficeSubscriptionChangeOrderUseCase", () => ({
  backofficeSubscriptionChangeOrderUseCase: { generatePayment: generatePaymentMock },
}))

const { POST } = await import("./route")

const params = Promise.resolve({ id: "order-1" })

function makeRequest() {
  return new NextRequest(
    "http://localhost/api/v1/backoffice/subscription-change-orders/order-1/generate-payment",
    { method: "POST" }
  )
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
  generatePaymentMock.mockClear()
  grantManagerAccess()
})

describe("POST /backoffice/subscription-change-orders/[id]/generate-payment", () => {
  it("operador sem fullAccess → 403, use case não invocado", async () => {
    grantOperatorAccess()

    const response = await POST(makeRequest(), { params })

    expect(response.status).toBe(403)
    expect(generatePaymentMock).not.toHaveBeenCalled()
  })

  it("manager → 200, use case invocado com o id da ordem", async () => {
    const response = await POST(makeRequest(), { params })

    expect(response.status).toBe(200)
    expect(generatePaymentMock).toHaveBeenCalledWith("order-1")
  })
})
