import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const asaasFetchMock = mock(async (): Promise<Record<string, unknown>> => ({ id: "pay_1", invoiceUrl: "https://x" }))
mock.module("@/lib/asaas", () => ({
  asaasFetch: asaasFetchMock,
  asaasApi: { payments: "payments", pixQrCode: (id: string) => `pix/${id}` },
}))

const { BackofficePaymentUseCase } = await import("./BackofficePaymentUseCase")
const { isMethodUnavailableOutput } = await import("@/lib/payment-methods/route-guard")

const originalEnv = { ...process.env }

function makeUseCase() {
  const paymentRepo = { create: mock(async (data: Record<string, unknown>) => data) }
  const clientRepo = { findById: mock(async () => ({ id: "c1", asaasCustomerId: "cus_1" })) }
  return { useCase: new BackofficePaymentUseCase(paymentRepo as never, clientRepo as never), paymentRepo }
}

describe("BackofficePaymentUseCase.createPayment — cartão desligado", () => {
  beforeEach(() => {
    asaasFetchMock.mockClear()
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
    delete process.env.CARD_PAYMENTS_ENABLED
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("CREDIT_CARD -> erro marcado, sem cobrança no Asaas nem registro", async () => {
    const { useCase, paymentRepo } = makeUseCase()

    const output = await useCase.createPayment({ clientId: "c1", amount: 100, billingType: "CREDIT_CARD" }, "p1")

    expect(output.isValid).toBe(false)
    expect(isMethodUnavailableOutput(output)).toBe(true)
    expect(asaasFetchMock).not.toHaveBeenCalled()
    expect(paymentRepo.create).not.toHaveBeenCalled()
  })

  it("PIX segue criando a cobrança", async () => {
    const { useCase, paymentRepo } = makeUseCase()

    const output = await useCase.createPayment({ clientId: "c1", amount: 100, billingType: "PIX" }, "p1")

    expect(output.isValid).toBe(true)
    expect(paymentRepo.create).toHaveBeenCalledTimes(1)
  })
})
