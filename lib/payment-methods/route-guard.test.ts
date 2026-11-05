import { describe, expect, it } from "bun:test"
import { PaymentMethodUnavailableError } from "./availability"
import { rejectUnavailableBillingType, toPaymentMethodUnavailableResponse } from "./route-guard"

const WITH_KEY = { PAYMENT_PROVIDER_ENVIRONMENT: "PRODUCTION", ABACATE_PAY_PRODUCTION_PUBLIC_KEY: "pk" }
const WITHOUT_KEY = { PAYMENT_PROVIDER_ENVIRONMENT: "PRODUCTION" }
const flagOn = async () => true
const flagOff = async () => false

describe("route-guard", () => {
  it("cartão sem chave pública -> 422 com Output de erro", async () => {
    const response = await rejectUnavailableBillingType("CREDIT_CARD", WITHOUT_KEY, flagOn)
    expect(response?.status).toBe(422)
    const json = await response!.json()
    expect(json.isValid).toBe(false)
    expect(json.errorMessages[0]).toContain("PIX")
  })
  it("chave presente e flag do backoffice desligada -> 422", async () => {
    const response = await rejectUnavailableBillingType("CREDIT_CARD", WITH_KEY, flagOff)
    expect(response?.status).toBe(422)
  })
  it("chave presente e flag ligada -> passa", async () => {
    expect(await rejectUnavailableBillingType("CREDIT_CARD", WITH_KEY, flagOn)).toBeNull()
  })
  it("PIX e ausência de método passam sem consultar a flag", async () => {
    const failingReader = async () => {
      throw new Error("não deveria ler")
    }
    const env = { ...WITH_KEY, CARD_PAYMENTS_ENABLED: "false" }
    expect(await rejectUnavailableBillingType("PIX", env, failingReader)).toBeNull()
    expect(await rejectUnavailableBillingType(undefined, env, failingReader)).toBeNull()
  })
  it("mapeia somente PaymentMethodUnavailableError", () => {
    expect(toPaymentMethodUnavailableResponse(new Error("x"))).toBeNull()
    expect(toPaymentMethodUnavailableResponse(new PaymentMethodUnavailableError())?.status).toBe(422)
  })
})
