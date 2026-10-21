import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"

const findUniqueMock = mock(async () => null)
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: { profile: { findUnique: findUniqueMock, update: mock(async () => ({})) } },
}))
const asaasFetchMock = mock(async () => ({ id: "pay_1", invoiceUrl: "https://x" }))
mock.module("@/lib/asaas", () => ({ asaasApi: { payments: "payments" }, asaasFetch: asaasFetchMock }))
mock.module("@/app/api/services/AsaasCustomer/AsaasCustomerService", () => ({
  asaasCustomerService: { createCustomer: mock(async () => ({ customerId: "cus_1" })) },
}))
mock.module("@/lib/billing/resolvePrice", () => ({ resolvePrice: mock(async () => 100) }))

const { POST } = await import("./route")

const originalEnv = { ...process.env }

function makeRequest() {
  return new NextRequest("http://localhost/api/v1/payments/create-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supabaseId: "s1", fullName: "A", email: "a@x.com", cpfCnpj: "123" }),
  })
}

describe("POST /payments/create-card — cartão desligado", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    asaasFetchMock.mockClear()
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
    delete process.env.CARD_PAYMENTS_ENABLED
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("responde 422 sem tocar no banco nem no Asaas", async () => {
    const response = await POST(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(422)
    expect(json.isValid).toBe(false)
    expect(findUniqueMock).not.toHaveBeenCalled()
    expect(asaasFetchMock).not.toHaveBeenCalled()
  })

  it("CARD_PAYMENTS_ENABLED=false bloqueia mesmo com a chave pública", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    process.env.CARD_PAYMENTS_ENABLED = "false"

    const response = await POST(makeRequest())

    expect(response.status).toBe(422)
    expect(asaasFetchMock).not.toHaveBeenCalled()
  })

  it("com o cartão liberado segue o fluxo normal (perfil inexistente -> 404)", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"

    const response = await POST(makeRequest())

    expect(response.status).toBe(404)
  })
})
