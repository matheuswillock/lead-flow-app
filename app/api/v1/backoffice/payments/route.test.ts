import { describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { PaymentMethodUnavailableError } from "@/lib/payment-methods/availability"
import { markedUnavailableOutput } from "@/lib/payment-methods/route-guard"

mock.module("@/app/api/v1/backoffice/utils/getBackofficeAccess", () => ({
  getBackofficeAccess: mock(async () => ({ access: { profileId: "bo-1" } })),
}))
mock.module("@/app/api/v1/backoffice/utils/requireManagerAccess", () => ({
  requireManagerAccess: mock(() => null),
}))
mock.module("@/app/api/infra/data/repositories/backoffice/PaymentRepository/BackofficePaymentRepository", () => ({
  BackofficePaymentRepository: class {},
}))
mock.module("@/app/api/infra/data/repositories/backoffice/ClientRepository/BackofficeClientRepository", () => ({
  BackofficeClientRepository: class {},
}))

const createPaymentMock = mock(async (): Promise<Output> => markedUnavailableOutput(new PaymentMethodUnavailableError()))
mock.module("@/app/api/useCases/backoffice/BackofficePaymentUseCase", () => ({
  BackofficePaymentUseCase: class {
    createPayment = createPaymentMock
    listPayments = mock(async () => new Output(true, [], [], []))
  },
}))

const { POST } = await import("./route")

const makeRequest = (billingType: string) =>
  new NextRequest("http://localhost/api/v1/backoffice/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: "c1", amount: 10, billingType }),
  })

describe("POST /backoffice/payments — cartão desligado", () => {
  it("método indisponível -> 422", async () => {
    const response = await POST(makeRequest("CREDIT_CARD"))

    expect(response.status).toBe(422)
  })

  it("sucesso -> 201 e demais falhas -> 400", async () => {
    createPaymentMock.mockResolvedValueOnce(new Output(true, ["ok"], [], { id: "p1" }))
    expect((await POST(makeRequest("PIX"))).status).toBe(201)

    createPaymentMock.mockResolvedValueOnce(new Output(false, [], ["Cliente não encontrado"], null))
    expect((await POST(makeRequest("PIX"))).status).toBe(400)
  })
})
