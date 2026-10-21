import { describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { PaymentMethodUnavailableError } from "@/lib/payment-methods/availability"

const createCheckoutMock = mock(async (): Promise<Output> => {
  throw new PaymentMethodUnavailableError()
})
mock.module("@/app/api/useCases/billingCheckoutIntent/BillingCheckoutIntentUseCase", () => ({
  billingCheckoutIntentUseCase: { createCheckout: createCheckoutMock, getPublicDetails: mock(async () => new Output(true, [], [], {})) },
}))

const { POST } = await import("./route")

function makeRequest(billingType: string) {
  return new NextRequest("http://localhost/api/v1/billing/checkout-intents/tok", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ billingType }),
  })
}

const params = { params: Promise.resolve({ token: "tok" }) }

describe("POST /billing/checkout-intents/[token] — cartão desligado", () => {
  it("PaymentMethodUnavailableError -> 422 mantendo `error` e o Output padrão", async () => {
    const response = await POST(makeRequest("CREDIT_CARD"), params)
    const json = await response.json()

    expect(response.status).toBe(422)
    expect(json.error).toContain("PIX")
    expect(json.isValid).toBe(false)
    expect(json.errorMessages[0]).toContain("PIX")
  })

  it("outros erros continuam 400", async () => {
    createCheckoutMock.mockRejectedValueOnce(new Error("Link de pagamento inválido"))

    const response = await POST(makeRequest("PIX"), params)

    expect(response.status).toBe(400)
  })
})
