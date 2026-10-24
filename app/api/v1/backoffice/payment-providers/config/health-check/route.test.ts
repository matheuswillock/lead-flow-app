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

const checkMock = mock(
  async (_input: unknown) => new Output(true, ["Health-check executado"], [], { healthStatus: "HEALTHY" }),
)

mock.module("@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition", () => ({
  paymentProviderHealthCheckUseCase: { check: checkMock },
  paymentProviderConfigUseCase: {},
}))

const { POST } = await import("./route")

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/backoffice/payment-providers/config/health-check", {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "localhost", origin: "http://localhost" },
    body: JSON.stringify(body),
  })
}

function grantAccess(isOperator: boolean) {
  accessResult = {
    access: {
      supabaseId: "supa-1",
      profileId: "bo-profile-1",
      backofficeUserId: "bo-1",
      backofficeEmail: "dono@corretorstudio.com",
      fullAccess: !isOperator,
      isOperator,
    },
  }
}

beforeEach(() => {
  checkMock.mockClear()
})

describe("POST /api/v1/backoffice/payment-providers/config/health-check", () => {
  it("devolve 401 sem autenticação e não executa o health-check", async () => {
    accessResult = { error: new Output(false, [], ["Não autenticado"], null), status: 401 }

    const response = await POST(makeRequest({ provider: "ABACATE_PAY", environment: "PRODUCTION" }))

    expect(response.status).toBe(401)
    expect(checkMock).not.toHaveBeenCalled()
  })

  it("devolve 403 para operator e não executa o health-check", async () => {
    grantAccess(true)

    const response = await POST(makeRequest({ provider: "ABACATE_PAY", environment: "PRODUCTION" }))

    expect(response.status).toBe(403)
    expect(checkMock).not.toHaveBeenCalled()
  })

  it("devolve 400 para payload inválido", async () => {
    grantAccess(false)

    const response = await POST(makeRequest({ provider: "OUTRO", environment: "PRODUCTION" }))

    expect(response.status).toBe(400)
    expect(checkMock).not.toHaveBeenCalled()
  })

  it("aceita o id da instância e rejeita Origin de outro site", async () => {
    grantAccess(false)
    const id = "11111111-1111-4111-8111-111111111111"
    expect((await POST(makeRequest({ id }))).status).toBe(200)
    expect(checkMock).toHaveBeenCalledWith({ id, actor: { profileId: "bo-profile-1", backofficeUserId: "bo-1" } })
    const forged = new NextRequest("http://localhost/api/v1/backoffice/payment-providers/config/health-check", {
      method: "POST",
      headers: { "Content-Type": "application/json", host: "localhost", origin: "https://evil.com" },
      body: JSON.stringify({ id }),
    })
    checkMock.mockClear()
    expect((await POST(forged)).status).toBe(403)
    expect(checkMock).not.toHaveBeenCalled()
  })

  it("executa o health-check para manager propagando o ator", async () => {
    grantAccess(false)

    const response = await POST(makeRequest({ provider: "ABACATE_PAY", environment: "PRODUCTION" }))

    expect(response.status).toBe(200)
    expect(checkMock).toHaveBeenCalledWith({
      provider: "ABACATE_PAY",
      environment: "PRODUCTION",
      actor: { profileId: "bo-profile-1", backofficeUserId: "bo-1" },
    })
  })
})
