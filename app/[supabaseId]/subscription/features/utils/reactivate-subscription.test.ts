import { describe, expect, it } from "bun:test"
import { buildReactivationPayload, extractPixPaymentId } from "./reactivate-subscription"

describe("extractPixPaymentId (T-21.8)", () => {
  it("paymentId presente → retorna o paymentId", () => {
    expect(extractPixPaymentId({ paymentId: "pay_123" })).toBe("pay_123")
  })

  it("sem paymentId, mesmo com subscriptionId no mesmo objeto → null (sem fallback)", () => {
    // Regressão do bug: `result.result.paymentId || result.result.subscriptionId`
    // fazia o polling consultar payment-status com um id que não é de
    // pagamento — nunca confirma, mesmo com o PIX pago.
    expect(
      extractPixPaymentId({ paymentId: undefined, subscriptionId: "sub_456" } as { paymentId?: string })
    ).toBeNull()
  })

  it("result ausente/null → null", () => {
    expect(extractPixPaymentId(null)).toBeNull()
    expect(extractPixPaymentId(undefined)).toBeNull()
  })

  it("paymentId string vazia → null (não é um id válido)", () => {
    expect(extractPixPaymentId({ paymentId: "" })).toBeNull()
  })
})

describe("buildReactivationPayload (T-21.10)", () => {
  const creditCardFormData = {
    holderName: "Fulano de Tal",
    number: "4111111111111111",
    expiryMonth: "12",
    expiryYear: "2030",
    ccv: "123",
    name: "Fulano de Tal",
    cpfCnpj: "12345678900",
    postalCode: "01310-100",
    addressNumber: "100",
    phone: "",
    mobilePhone: "11999999999",
  }

  it("cartão de crédito: payload NUNCA contém `remoteIp` forjado", () => {
    const payload = buildReactivationPayload({
      supabaseId: "supabase-1",
      operatorCount: 2,
      paymentMethod: "CREDIT_CARD",
      managerEmail: "manager@example.com",
      creditCardFormData,
    })

    expect(payload).not.toHaveProperty("remoteIp")
    expect(JSON.stringify(payload)).not.toContain("127.0.0.1")
  })

  it("cartão de crédito: inclui creditCard e creditCardHolderInfo", () => {
    const payload = buildReactivationPayload({
      supabaseId: "supabase-1",
      operatorCount: 0,
      paymentMethod: "CREDIT_CARD",
      managerEmail: "manager@example.com",
      creditCardFormData,
    })

    expect(payload.creditCard).toMatchObject({ number: "4111111111111111", ccv: "123" })
    expect(payload.creditCardHolderInfo).toMatchObject({ email: "manager@example.com" })
    expect(payload).not.toHaveProperty("remoteIp")
  })

  it("PIX: não inclui dados de cartão nem remoteIp", () => {
    const payload = buildReactivationPayload({
      supabaseId: "supabase-1",
      operatorCount: 1,
      paymentMethod: "PIX",
      managerEmail: "manager@example.com",
      creditCardFormData: null,
    })

    expect(payload).not.toHaveProperty("creditCard")
    expect(payload).not.toHaveProperty("creditCardHolderInfo")
    expect(payload).not.toHaveProperty("remoteIp")
  })
})
