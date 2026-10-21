import { afterEach, describe, expect, it } from "bun:test"
import { PaymentMethodUnavailableError } from "./availability"
import { rejectUnavailableBillingType, toPaymentMethodUnavailableResponse } from "./route-guard"

const original = { ...process.env }
afterEach(() => {
  process.env = { ...original }
})

describe("route-guard", () => {
  it("cartão desligado -> 422 com Output de erro", async () => {
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
    const response = rejectUnavailableBillingType("CREDIT_CARD")
    expect(response?.status).toBe(422)
    const json = await response!.json()
    expect(json.isValid).toBe(false)
    expect(json.errorMessages[0]).toContain("PIX")
  })
  it("PIX e ausência de método passam", () => {
    process.env.CARD_PAYMENTS_ENABLED = "false"
    expect(rejectUnavailableBillingType("PIX")).toBeNull()
    expect(rejectUnavailableBillingType(undefined)).toBeNull()
  })
  it("mapeia somente PaymentMethodUnavailableError", () => {
    expect(toPaymentMethodUnavailableResponse(new Error("x"))).toBeNull()
    expect(toPaymentMethodUnavailableResponse(new PaymentMethodUnavailableError())?.status).toBe(422)
  })
})
