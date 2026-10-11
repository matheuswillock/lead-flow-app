import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  connection: mock(async () => undefined),
}))

const getContext = mock(async () => new Output(true, [], [], {
  clientName: "Cliente",
  status: "requires_card_reauth",
  expiresAt: new Date("2026-10-11T12:00:00.000Z"),
}))
const submit = mock(async () => new Output(true, [], [], { status: "done" }))

mock.module("@/app/api/useCases/asaasAccountMigration/cardReauthorizationFactory", () => ({
  cardReauthorizationUseCase: { getContext, submit },
}))

const { GET, POST } = await import("./route")

function request(method: "GET" | "POST" = "GET") {
  return new NextRequest("http://localhost/api/v1/billing/card-reauthorization/token", {
    method,
    headers: {
      "content-type": "application/json",
      "x-supabase-user-id": "master-1",
      "x-forwarded-for": "203.0.113.10",
    },
    body: method === "POST" ? JSON.stringify({
      card: { holderName: "Cliente", number: "4111111111111111", expiryMonth: "12", expiryYear: "2030", ccv: "123" },
      cardholder: { name: "Cliente", email: "cliente@example.com", cpfCnpj: "12345678901", postalCode: "01001000", addressNumber: "1" },
    }) : undefined,
  })
}

beforeEach(() => {
  getContext.mockReset()
  submit.mockReset()
  getContext.mockResolvedValue(new Output(true, [], [], {
    clientName: "Cliente",
    status: "requires_card_reauth",
    expiresAt: new Date("2026-10-11T12:00:00.000Z"),
  }))
  submit.mockResolvedValue(new Output(true, [], [], { status: "done" }))
})

describe("card reauthorization route", () => {
  it("retorna 403 para master banido no GET e no POST", async () => {
    getContext.mockResolvedValue(new Output(false, [], ["Acesso suspenso"], { reason: "banned" }))

    const getResponse = await GET(request(), { params: Promise.resolve({ token: "token" }) })
    const postResponse = await POST(request("POST"), { params: Promise.resolve({ token: "token" }) })

    expect(getResponse.status).toBe(403)
    expect(postResponse.status).toBe(403)
    expect(submit).not.toHaveBeenCalled()
  })

  it.each([
    ["rate_limited", 429],
    ["already_processing", 423],
    ["invalid_or_expired", 410],
    ["declined", 409],
  ] as const)("mapeia %s para HTTP %d", async (reason, expectedStatus) => {
    submit.mockResolvedValue(new Output(false, [], ["Falha genérica"], { reason }))

    const response = await POST(request("POST"), { params: Promise.resolve({ token: "token" }) })
    const serialized = JSON.stringify(await response.json())

    expect(response.status).toBe(expectedStatus)
    expect(serialized).not.toContain("4111111111111111")
    expect(serialized).not.toContain('"123"')
  })
})
