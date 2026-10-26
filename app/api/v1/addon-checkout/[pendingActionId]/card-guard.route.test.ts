import { describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { PaymentMethodUnavailableError } from "@/lib/payment-methods/availability"
import { markedUnavailableOutput } from "@/lib/payment-methods/route-guard"

const createPaymentMock = mock(async () => markedUnavailableOutput(new PaymentMethodUnavailableError()))
const updateBillingTypeMock = mock(async () => markedUnavailableOutput(new PaymentMethodUnavailableError()))

mock.module("@/app/api/useCases/addOnCheckout/AddOnCheckoutUseCase", () => ({
  addOnCheckoutUseCase: { createPayment: createPaymentMock, updateBillingType: updateBillingTypeMock },
}))

const { POST: pay } = await import("./pay/route")
const { PATCH: patchBillingType } = await import("./billing-type/route")

const params = { params: Promise.resolve({ pendingActionId: "pa-1" }) }

function makeRequest(method: string, body: unknown) {
  return new NextRequest("http://localhost/api/v1/addon-checkout/pa-1/x", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("addon-checkout — mapeamento do método indisponível", () => {
  it("POST /pay -> 422 quando o UseCase recusa o cartão", async () => {
    const response = await pay(makeRequest("POST", { billingType: "CREDIT_CARD" }), params)
    const json = await response.json()

    expect(response.status).toBe(422)
    expect(json.isValid).toBe(false)
    expect(json.errorMessages[0]).toContain("PIX")
  })

  it("PATCH /billing-type -> 422 quando o UseCase recusa o cartão", async () => {
    const response = await patchBillingType(makeRequest("PATCH", { billingType: "CREDIT_CARD" }), params)

    expect(response.status).toBe(422)
  })

  it("falhas comuns continuam 400", async () => {
    createPaymentMock.mockResolvedValueOnce(new Output(false, [], ["Esta ação já foi processada"], null))

    const response = await pay(makeRequest("POST", { billingType: "PIX" }), params)

    expect(response.status).toBe(400)
  })

  it("sucesso continua 201", async () => {
    createPaymentMock.mockResolvedValueOnce(new Output(true, ["ok"], [], { paymentId: "pay_1" }))

    const response = await pay(makeRequest("POST", { billingType: "PIX" }), params)

    expect(response.status).toBe(201)
  })
})
