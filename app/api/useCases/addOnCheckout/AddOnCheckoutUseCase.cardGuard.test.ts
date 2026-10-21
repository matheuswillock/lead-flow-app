import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const baseAction = {
  id: "pa-1",
  masterId: "master-1",
  teamId: "team-1",
  actionType: "add_user" as const,
  status: "pending" as const,
  payload: { billingType: "CREDIT_CARD", totalCharge: 100 },
  checkoutId: null,
  paymentId: null,
  asaasAccount: "primary" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  master: { id: "master-1", fullName: "Master", email: "m@x.com", asaasSubscriptionId: null },
} as any

const findByIdMock = mock(async () => ({ ...baseAction }))
const findByIdSimpleMock = mock(async () => ({ ...baseAction }))
const updatePayloadMock = mock(async () => {})
const clearPaymentIdMock = mock(async () => {})
const updatePaymentIdMock = mock(async () => {})

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: {
    findById: findByIdMock,
    findByIdSimple: findByIdSimpleMock,
    updateStatus: mock(async () => {}),
    updatePayload: updatePayloadMock,
    clearPaymentId: clearPaymentIdMock,
    updatePaymentId: updatePaymentIdMock,
  },
}))
mock.module("@/app/api/useCases/pendingActions/PendingActionUseCase", () => ({ pendingActionUseCase: {} }))

const createIncrementalChargeMock = mock(async () => ({
  paymentId: "pay_1",
  paymentStatus: "PENDING",
  billingType: "CREDIT_CARD",
  amount: 100,
  dueDate: "2026-10-20",
}))
mock.module("@/app/api/services/billing/IncrementalBillingService", () => ({
  incrementalBillingService: { createIncrementalCharge: createIncrementalChargeMock },
}))

let subscriptionBillingType = "CREDIT_CARD"
mock.module("@/lib/asaas", () => ({
  createAsaasClient: () => ({
    endpoints: { payments: "payments", subscriptions: "subscriptions" },
    request: async () => ({
      billingType: subscriptionBillingType,
      creditCard: { creditCardToken: "tok_1" },
    }),
  }),
}))

const { AddOnCheckoutUseCase } = await import("./AddOnCheckoutUseCase")

const PAYMENT_INPUT = {
  billingType: "CREDIT_CARD" as const,
  fullName: "Fulano",
  email: "f@x.com",
  phone: "11999999999",
  cpfCnpj: "12345678900",
  postalCode: "01310100",
  address: "Av",
  addressNumber: "1",
  neighborhood: "Centro",
  remoteIp: "1.1.1.1",
}

const originalEnv = { ...process.env }

function setCardOff() {
  process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
  delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
  delete process.env.CARD_PAYMENTS_ENABLED
}

function withSubscriber() {
  findByIdMock.mockImplementation(async () => ({
    ...baseAction,
    master: { ...baseAction.master, asaasSubscriptionId: "sub_1", asaasSubscriptionAccount: "primary" },
  }))
}

describe("AddOnCheckoutUseCase — guard de cartão desligado", () => {
  beforeEach(() => {
    setCardOff()
    subscriptionBillingType = "CREDIT_CARD"
    findByIdMock.mockReset()
    findByIdMock.mockImplementation(async () => ({ ...baseAction }))
    findByIdSimpleMock.mockReset()
    findByIdSimpleMock.mockImplementation(async () => ({ ...baseAction, payload: { billingType: "PIX" } }))
    createIncrementalChargeMock.mockClear()
    updatePayloadMock.mockClear()
    clearPaymentIdMock.mockClear()
    updatePaymentIdMock.mockClear()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("createPayment com cartão off e sem cartão existente -> erro marcado, sem cobrança", async () => {
    const output = await new AddOnCheckoutUseCase().createPayment("pa-1", PAYMENT_INPUT)

    expect(output.isValid).toBe(false)
    expect((output.result as { code: string }).code).toBe("PAYMENT_METHOD_UNAVAILABLE")
    expect(createIncrementalChargeMock).not.toHaveBeenCalled()
    expect(updatePaymentIdMock).not.toHaveBeenCalled()
  })

  it("createPayment com cartão off mas assinante com cartão -> cobra com o token existente", async () => {
    withSubscriber()

    const output = await new AddOnCheckoutUseCase().createPayment("pa-1", PAYMENT_INPUT)

    expect(output.isValid).toBe(true)
    expect(createIncrementalChargeMock).toHaveBeenCalledTimes(1)
  })

  it("assinatura do tipo PIX não é isenção", async () => {
    withSubscriber()
    subscriptionBillingType = "PIX"

    const output = await new AddOnCheckoutUseCase().createPayment("pa-1", PAYMENT_INPUT)

    expect(output.isValid).toBe(false)
    expect(createIncrementalChargeMock).not.toHaveBeenCalled()
  })

  it("PIX sempre passa com o cartão off", async () => {
    findByIdMock.mockImplementation(async () => ({ ...baseAction, payload: { billingType: "PIX", totalCharge: 100 } }))
    createIncrementalChargeMock.mockResolvedValueOnce({
      paymentId: "pay_2",
      paymentStatus: "PENDING",
      billingType: "PIX",
      amount: 100,
      dueDate: "2026-10-20",
    })

    const output = await new AddOnCheckoutUseCase().createPayment("pa-1", { ...PAYMENT_INPUT, billingType: "PIX" })

    expect(output.isValid).toBe(true)
  })

  it("CARD_PAYMENTS_ENABLED=false bloqueia mesmo com a chave pública presente", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    process.env.CARD_PAYMENTS_ENABLED = "false"

    const output = await new AddOnCheckoutUseCase().createPayment("pa-1", PAYMENT_INPUT)

    expect(output.isValid).toBe(false)
    expect(createIncrementalChargeMock).not.toHaveBeenCalled()
  })

  it("updateBillingType para cartão com cartão off -> erro marcado, payload intacto", async () => {
    const output = await new AddOnCheckoutUseCase().updateBillingType("pa-1", "CREDIT_CARD")

    expect(output.isValid).toBe(false)
    expect((output.result as { code: string }).code).toBe("PAYMENT_METHOD_UNAVAILABLE")
    expect(updatePayloadMock).not.toHaveBeenCalled()
    expect(clearPaymentIdMock).not.toHaveBeenCalled()
  })

  it("updateBillingType para PIX passa com o cartão off", async () => {
    findByIdSimpleMock.mockImplementation(async () => ({ ...baseAction, payload: { billingType: "CREDIT_CARD" } }))

    const output = await new AddOnCheckoutUseCase().updateBillingType("pa-1", "PIX")

    expect(output.isValid).toBe(true)
    expect(updatePayloadMock).toHaveBeenCalledTimes(1)
  })

  it("getCheckoutDetails devolve só PIX para quem não tem cartão", async () => {
    const output = await new AddOnCheckoutUseCase().getCheckoutDetails("pa-1")

    expect(output.isValid).toBe(true)
    expect(output.result.availableBillingTypes).toEqual(["PIX"])
  })

  it("getCheckoutDetails mantém o cartão para assinante com cartão", async () => {
    withSubscriber()

    const output = await new AddOnCheckoutUseCase().getCheckoutDetails("pa-1")

    expect(output.result.availableBillingTypes).toEqual(["PIX", "CREDIT_CARD"])
  })
})
