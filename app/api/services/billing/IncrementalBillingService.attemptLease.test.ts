import { beforeEach, describe, expect, it, mock } from "bun:test"

// Achado Codex (PR #1407, P2): uma tentativa que já saiu para o AbacatePay (status PENDING,
// lease liberado) não pode ser re-leasada e cobrada de novo numa corrida ou num retry.

const createCustomerMock = mock(async (_input: unknown) => ({ id: "cus_gateway" }))
const paymentCreatePixMock = mock(async (_input: unknown) => ({
  status: "PENDING",
  externalId: "bill_1",
  method: "PIX",
  amountInCents: 1000,
  currency: "BRL",
  pix: { brCode: "copia-cola", brCodeBase64: "img", expiresAt: "2026-12-01T00:00:00.000Z" },
}))
const sessionCreateMock = mock(async (_input: unknown) => ({ id: "session-1" }))
const attemptCreateMock = mock(async (_input: unknown) => ({ id: "attempt-1", status: "CREATED" }))
const leaseMock = mock(async (_input: unknown) => ({
  id: "attempt-1",
  status: "CREATED",
  lease: { token: "lease" },
}))
const updateAttemptMock = mock(async (_input: unknown) => ({
  id: "attempt-1",
  externalId: "bill_1",
  status: "PENDING",
}))
const attachProviderAttemptMock = mock(async (_input: unknown) => ({}))

mock.module("@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway", () => ({
  asaasCustomerGateway: { createCustomer: createCustomerMock },
}))

mock.module("@/app/api/infra/data/repositories/billing/BillingRepository", () => ({
  billingRepository: {
    getBillingSnapshot: mock(async () => null),
    updateAsaasCustomerId: mock(async () => {}),
    updateSubscriptionData: mock(async () => {}),
    getSubscriptionEndDate: mock(async () => null),
  },
}))

mock.module("@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition", () => ({
  resolvePaymentProviderEnvironment: () => "DEV",
  createPaymentProviderRouter: async () => ({
    select: async () => ({ provider: "ABACATE_PAY", environment: "DEV", externalAccountContext: "ctx-dev" }),
  }),
  resolvePaymentProvider: async () => ({
    createPixPayment: paymentCreatePixMock,
    createCardPayment: mock(async () => ({})),
  }),
}))

mock.module("@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository", () => ({
  paymentProviderSessionRepository: {
    createSession: sessionCreateMock,
    createAttempt: attemptCreateMock,
    acquireAttemptLease: leaseMock,
    updateAttemptWithLease: updateAttemptMock,
  },
}))

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: { attachProviderAttempt: attachProviderAttemptMock },
}))

mock.module("@/lib/asaas", () => ({
  asaasApi: {},
  asaasFetch: mock(async () => ({})),
  createAsaasClient: () => {
    throw new Error("Asaas não deveria ser chamado numa cobrança AbacatePay")
  },
}))

const { IncrementalBillingService } = await import("./IncrementalBillingService")

const baseMaster = {
  id: "profile-master-1",
  fullName: "Master Teste",
  email: "master@example.test",
  cpfCnpj: "12345678901",
  phone: null,
  postalCode: null,
  address: null,
  addressNumber: null,
  neighborhood: null,
  complement: null,
  asaasCustomerId: null,
  asaasCustomerAccount: "primary" as const,
  asaasSubscriptionId: null,
  asaasSubscriptionAccount: "primary" as const,
  subscriptionStatus: "active",
  subscriptionNextDueDate: null,
  subscriptionCycle: "MONTHLY",
  hasPermanentSubscription: false,
  hasUnlimitedUsers: false,
  timezone: "America/Sao_Paulo",
}

const chargeInput = {
  master: baseMaster,
  pendingActionId: "pa-1",
  amount: 10,
  description: "teste",
  billingType: "PIX" as const,
}

describe("IncrementalBillingService — lease de tentativa já enviada ao provedor", () => {
  beforeEach(() => {
    paymentCreatePixMock.mockClear()
    attemptCreateMock.mockClear()
    attemptCreateMock.mockImplementation(async () => ({ id: "attempt-1", status: "CREATED" }))
    leaseMock.mockClear()
    leaseMock.mockImplementation(async () => ({ id: "attempt-1", status: "CREATED", lease: { token: "lease" } }))
    updateAttemptMock.mockClear()
    attachProviderAttemptMock.mockClear()
  })

  it("tentativa CREATED segue o fluxo normal e cobra uma vez", async () => {
    const result = await new IncrementalBillingService().createIncrementalCharge(chargeInput)

    expect(paymentCreatePixMock).toHaveBeenCalledTimes(1)
    expect(result.paymentId).toBe("provider-bill_1")
  })

  it("tentativa já PENDING (enviada ao provedor) não é cobrada de novo", async () => {
    leaseMock.mockImplementation(async () => ({ id: "attempt-1", status: "PENDING", lease: { token: "lease" } }))

    await expect(new IncrementalBillingService().createIncrementalCharge(chargeInput)).rejects.toThrow()

    expect(paymentCreatePixMock).not.toHaveBeenCalled()
    expect(updateAttemptMock).not.toHaveBeenCalled()
    expect(attachProviderAttemptMock).not.toHaveBeenCalled()
  })
})
