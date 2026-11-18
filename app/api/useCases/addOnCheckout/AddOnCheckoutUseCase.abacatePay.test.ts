import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { stubCardEnabledConfig } from "@/test/support/card-enabled-config"

// Achados Codex (PR #1407): (1) o checkout de add-on precisa expor a chave pública do
// AbacatePay para o cartão ser tokenizado; (2) um retry de cobrança AbacatePay devolve a
// cobrança guardada em vez de consultar o Asaas com um id `provider-...`.

const abacateAction = {
  id: "pa-1",
  masterId: "master-1",
  teamId: "team-1",
  actionType: "add_user" as const,
  status: "pending" as const,
  payload: { billingType: "PIX", totalCharge: 100 },
  checkoutId: null,
  paymentId: "provider-bill_1",
  provider: "ABACATE_PAY",
  providerAttemptId: "attempt-1",
  providerExternalId: "bill_1",
  asaasAccount: "primary" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  master: { id: "master-1", fullName: "Master", email: "m@x.com", asaasSubscriptionId: null },
} as any

const findByIdMock = mock(async () => ({ ...abacateAction }))
const findAttemptByIdMock = mock(async (_id: string) => ({
  id: "attempt-1",
  status: "PENDING",
  externalId: "bill_1",
  paymentInstructions: { brCode: "000201copia", brCodeBase64: "AAAA", expiresAt: "2999-01-01T00:00:00.000Z" },
}))
const createAsaasClientMock = mock((_account: string) => {
  throw new Error("Asaas não deveria ser consultado para uma cobrança AbacatePay")
})

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: {
    findById: findByIdMock,
    findByIdSimple: findByIdMock,
    updateStatus: mock(async () => {}),
    updatePayload: mock(async () => {}),
    clearPaymentId: mock(async () => {}),
    updatePaymentId: mock(async () => {}),
  },
}))
mock.module("@/app/api/useCases/pendingActions/PendingActionUseCase", () => ({ pendingActionUseCase: {} }))
mock.module("@/app/api/services/billing/IncrementalBillingService", () => ({
  incrementalBillingService: { createIncrementalCharge: mock(async () => ({})) },
}))
mock.module("@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository", () => ({
  paymentProviderSessionRepository: { findAttemptById: findAttemptByIdMock },
}))
mock.module("@/lib/asaas", () => ({ createAsaasClient: createAsaasClientMock }))

const { AddOnCheckoutUseCase } = await import("./AddOnCheckoutUseCase")

const PIX_INPUT = {
  billingType: "PIX" as const,
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

describe("AddOnCheckoutUseCase — retry de cobrança AbacatePay", () => {
  beforeEach(() => {
    findByIdMock.mockImplementation(async () => ({ ...abacateAction }))
    createAsaasClientMock.mockClear()
    findAttemptByIdMock.mockClear()
  })

  it("createPayment repetido devolve a cobrança guardada sem consultar o Asaas", async () => {
    const output = await new AddOnCheckoutUseCase().createPayment("pa-1", PIX_INPUT)

    expect(output.isValid).toBe(true)
    expect(createAsaasClientMock).not.toHaveBeenCalled()
    expect(findAttemptByIdMock).toHaveBeenCalledWith("attempt-1")
    const result = output.result as { paymentId: string; paymentStatus: string; pix: { payload: string } }
    expect(result.paymentId).toBe("provider-bill_1")
    expect(result.paymentStatus).toBe("PENDING")
    expect(result.pix.payload).toBe("000201copia")
  })
})

describe("AddOnCheckoutUseCase — cardCheckout no detalhe do checkout", () => {
  let restoreConfig: () => void = () => undefined

  beforeEach(() => {
    findByIdMock.mockImplementation(async () => ({
      ...abacateAction,
      paymentId: null,
      provider: null,
      providerAttemptId: null,
      payload: { billingType: "CREDIT_CARD", totalCharge: 100 },
    }))
  })

  afterEach(() => {
    restoreConfig()
    process.env = { ...originalEnv }
  })

  it("expõe a chave pública do AbacatePay quando o cartão está ligado", async () => {
    restoreConfig = stubCardEnabledConfig(true)
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_prod_test"

    const output = await new AddOnCheckoutUseCase().getCheckoutDetails("pa-1")

    expect(output.isValid).toBe(true)
    expect((output.result as { cardCheckout: unknown }).cardCheckout).toEqual({
      provider: "ABACATE_PAY",
      publicKey: "pk_prod_test",
    })
  })

  it("cardCheckout é null quando o cartão está desligado", async () => {
    restoreConfig = stubCardEnabledConfig(false)
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY

    const output = await new AddOnCheckoutUseCase().getCheckoutDetails("pa-1")

    expect((output.result as { cardCheckout: unknown }).cardCheckout).toBeNull()
  })
})
