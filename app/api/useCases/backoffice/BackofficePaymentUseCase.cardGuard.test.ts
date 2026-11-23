import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const asaasFetchMock = mock(async (): Promise<Record<string, unknown>> => {
  throw new Error("asaasFetch não deveria ser chamado numa cobrança avulsa AbacatePay")
})
mock.module("@/lib/asaas", () => ({
  asaasFetch: asaasFetchMock,
  asaasApi: { payments: "payments", pixQrCode: (id: string) => `pix/${id}` },
}))

const { stubCardEnabledConfig } = await import("@/test/support/card-enabled-config")
const { BackofficePaymentUseCase } = await import("./BackofficePaymentUseCase")
const { isMethodUnavailableOutput } = await import("@/lib/payment-methods/route-guard")

const originalEnv = { ...process.env }

const client = { id: "c1", fullName: "Cliente", email: "c@example.com", phone: "11999999999", cpfCnpj: "52998224725" }

function makeUseCase() {
  const paymentRepo = { create: mock(async (data: Record<string, unknown>) => data) }
  const clientRepo = { findById: mock(async () => client), updateCpfCnpj: mock(async () => client) }
  const charge = mock(async () => ({
    selected: { provider: "ABACATE_PAY" },
    session: { id: "s1" },
    attempt: { id: "a1", externalId: "pix_1" },
    outcome: { status: "PENDING", externalId: "pix_1", pix: { brCode: "x", brCodeBase64: "y", expiresAt: "2026-11-20T00:00:00.000Z" } },
  }))
  const useCase = new BackofficePaymentUseCase(paymentRepo as never, clientRepo as never, charge as never)
  return { useCase, paymentRepo, charge }
}

describe("BackofficePaymentUseCase.createPayment — cartão desligado", () => {
  let restoreConfig: () => void = () => undefined

  beforeEach(() => {
    restoreConfig = stubCardEnabledConfig(false)
    asaasFetchMock.mockClear()
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
    delete process.env.CARD_PAYMENTS_ENABLED
  })
  afterEach(() => {
    restoreConfig()
    process.env = { ...originalEnv }
  })

  it("CREDIT_CARD -> erro marcado, sem cobrança no provedor nem registro", async () => {
    const { useCase, paymentRepo, charge } = makeUseCase()

    const output = await useCase.createPayment(
      { clientId: "c1", amount: 100, billingType: "CREDIT_CARD", cardToken: "ctok_1" },
      "p1",
    )

    expect(output.isValid).toBe(false)
    expect(isMethodUnavailableOutput(output)).toBe(true)
    expect(charge).not.toHaveBeenCalled()
    expect(asaasFetchMock).not.toHaveBeenCalled()
    expect(paymentRepo.create).not.toHaveBeenCalled()
  })

  it("PIX segue criando a cobrança pelo provedor, sem Asaas", async () => {
    const { useCase, paymentRepo, charge } = makeUseCase()

    const output = await useCase.createPayment({ clientId: "c1", amount: 100, billingType: "PIX" }, "p1")

    expect(output.isValid).toBe(true)
    expect(charge).toHaveBeenCalledTimes(1)
    expect(paymentRepo.create).toHaveBeenCalledTimes(1)
    expect(asaasFetchMock).not.toHaveBeenCalled()
  })
})
