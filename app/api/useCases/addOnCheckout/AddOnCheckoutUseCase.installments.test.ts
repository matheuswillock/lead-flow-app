import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { stubCardEnabledConfig } from "@/test/support/card-enabled-config"

// Parcelamento por ciclo: o limite (payload.maxInstallments) é gravado a partir do ciclo do contrato
// e o backend recusa qualquer pedido acima dele antes de falar com o provedor.

const action = (maxInstallments: number) =>
  ({
    id: "pa-1",
    masterId: "master-1",
    teamId: "team-1",
    actionType: "add_user" as const,
    status: "pending" as const,
    payload: { billingType: "CREDIT_CARD", totalCharge: 1200, maxInstallments },
    checkoutId: null,
    paymentId: null,
    asaasAccount: "primary" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    master: {
      id: "master-1",
      fullName: "Master",
      email: "m@x.com",
      asaasSubscriptionId: "sub_1",
      asaasSubscriptionAccount: "primary",
    },
  }) as any

const findByIdMock = mock(async () => action(1))
const updatePayloadMock = mock(async () => {})

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: {
    findById: findByIdMock,
    updatePayload: updatePayloadMock,
    updatePaymentId: mock(async () => {}),
  },
}))
mock.module("@/app/api/useCases/pendingActions/PendingActionUseCase", () => ({ pendingActionUseCase: {} }))

const createIncrementalChargeMock = mock(async (_input: unknown) => ({
  paymentId: "pay_1",
  paymentStatus: "PENDING",
  billingType: "CREDIT_CARD",
  amount: 1200,
  dueDate: "2026-11-24",
}))
mock.module("@/app/api/services/billing/IncrementalBillingService", () => ({
  incrementalBillingService: { createIncrementalCharge: createIncrementalChargeMock },
}))

mock.module("@/lib/asaas", () => ({
  createAsaasClient: () => ({
    endpoints: { payments: "payments", subscriptions: "subscriptions" },
    request: async () => ({ billingType: "CREDIT_CARD", creditCard: { creditCardToken: "tok_1" } }),
  }),
}))

const { AddOnCheckoutUseCase } = await import("./AddOnCheckoutUseCase")

const PAYMENT_INPUT = {
  termsAccepted: true as const,
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

describe("AddOnCheckoutUseCase.createPayment — parcelas por ciclo", () => {
  let restoreConfig: () => void = () => undefined

  beforeEach(() => {
    restoreConfig = stubCardEnabledConfig(true)
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_test_card_on"
    createIncrementalChargeMock.mockClear()
    updatePayloadMock.mockClear()
  })

  afterEach(() => {
    restoreConfig()
    process.env = { ...originalEnv }
  })

  async function pay(maxInstallments: number, installments?: number) {
    findByIdMock.mockImplementation(async () => action(maxInstallments))
    return new AddOnCheckoutUseCase().createPayment("pa-1", { ...PAYMENT_INPUT, installments })
  }

  it("mensal (máximo 1) rejeita 2x sem cobrar nem gravar aceite", async () => {
    const output = await pay(1, 2)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Este contrato permite apenas pagamento à vista (1x) no cartão."])
    expect(createIncrementalChargeMock).not.toHaveBeenCalled()
    expect(updatePayloadMock).not.toHaveBeenCalled()
  })

  it("mensal aceita 1x e sem parcelas informadas cobra à vista", async () => {
    expect((await pay(1, 1)).isValid).toBe(true)
    expect((await pay(1)).isValid).toBe(true)

    const calls = createIncrementalChargeMock.mock.calls as unknown as Array<[{ installments: number }]>
    expect(calls.map(([input]) => input.installments)).toEqual([1, 1])
  })

  it("anual (máximo 12) aceita 12x e repassa o valor validado ao serviço de cobrança", async () => {
    const output = await pay(12, 12)

    expect(output.isValid).toBe(true)
    const [[input]] = createIncrementalChargeMock.mock.calls as unknown as Array<[{ installments: number }]>
    expect(input.installments).toBe(12)
  })

  it("anual rejeita 13x com o limite na mensagem", async () => {
    const output = await pay(12, 13)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Parcelamento acima do permitido: este contrato permite até 12x no cartão."])
    expect(createIncrementalChargeMock).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5, Number.NaN])("rejeita número de parcelas inválido (%p)", async (installments) => {
    const output = await pay(12, installments)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Número de parcelas inválido."])
    expect(createIncrementalChargeMock).not.toHaveBeenCalled()
  })

  it("ação antiga sem maxInstallments no payload é tratada como 1x", async () => {
    findByIdMock.mockImplementation(async () => {
      const legacy = action(0)
      delete legacy.payload.maxInstallments
      return legacy
    })

    const output = await new AddOnCheckoutUseCase().createPayment("pa-1", { ...PAYMENT_INPUT, installments: 2 })

    expect(output.isValid).toBe(false)
    expect(createIncrementalChargeMock).not.toHaveBeenCalled()
  })
})
