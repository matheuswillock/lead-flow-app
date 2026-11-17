import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-40.4 a T-40.8 de [[40 — Checkout, Adesões e Add-ons — Backend]] (E2):
// GET/PUT/DELETE de assinatura roteiam pela conta do master; ensureCustomer
// nunca recria em erro (DA1). Cobrança nova de add-on vai para AbacatePay (Fase B-1).

const createCustomerMock = mock(async (_input: unknown) => ({ id: "cus_gateway" }))
const updateAsaasCustomerIdMock = mock(async () => {})
const updateSubscriptionDataMock = mock(async () => {})
const getBillingSnapshotMock = mock(async () => null)
const getSubscriptionEndDateMock = mock(async () => null)

const paymentCreatePixMock = mock(async (_input: unknown) => ({
  status: "PENDING",
  externalId: "bill_1",
  method: "PIX",
  amountInCents: 1000,
  currency: "BRL",
  pix: { brCode: "copia-cola", brCodeBase64: "img", expiresAt: "2026-12-01T00:00:00.000Z" },
}))
const cardCreateMock = mock(async (_input: unknown) => ({}))
const sessionCreateMock = mock(async (_input: unknown) => ({ id: "session-1" }))
const attemptCreateMock = mock(async (_input: unknown) => ({ id: "attempt-1" }))
const leaseMock = mock(async (_input: unknown) => ({ id: "attempt-1", lease: { token: "lease" } }))
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
    getBillingSnapshot: getBillingSnapshotMock,
    updateAsaasCustomerId: updateAsaasCustomerIdMock,
    updateSubscriptionData: updateSubscriptionDataMock,
    getSubscriptionEndDate: getSubscriptionEndDateMock,
  },
}))

mock.module("@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition", () => ({
  resolvePaymentProviderEnvironment: () => "DEV",
  createPaymentProviderRouter: async () => ({
    select: async () => ({ provider: "ABACATE_PAY", environment: "DEV", externalAccountContext: "ctx-dev" }),
  }),
  createAbacatePayProvider: async () => ({
    createPixPayment: paymentCreatePixMock,
    createCardPayment: cardCreateMock,
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

type RequestCall = { account: string; url: string; init?: RequestInit }
const requestLog: RequestCall[] = []

const requestImplByAccount: Record<string, (url: string, init?: RequestInit) => Promise<any>> = {}

const endpointsFor = (accountId: string) => ({
  subscriptions: `https://sandbox.asaas.com/api/v3/subscriptions?account=${accountId}`,
  customers: `https://sandbox.asaas.com/api/v3/customers?account=${accountId}`,
  payments: `https://sandbox.asaas.com/api/v3/payments?account=${accountId}`,
  pixQrCode: (id: string) => `https://sandbox.asaas.com/api/v3/payments/${id}/pixQrCode?account=${accountId}`,
})

const asaasFetchMock = mock(async (_url: string, _init?: RequestInit) => ({
  id: "sub_primary",
}))

mock.module("@/lib/asaas", () => ({
  asaasApi: endpointsFor("primary"),
  asaasFetch: asaasFetchMock,
  createAsaasClient: (accountId: "primary" | "legacy") => ({
    endpoints: endpointsFor(accountId),
    request: async (url: string, init?: RequestInit) => {
      requestLog.push({ account: accountId, url, init })
      const impl = requestImplByAccount[accountId]
      if (!impl) {
        throw new Error(`sem mock de request configurado para a conta ${accountId}`)
      }
      return impl(url, init)
    },
  }),
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
  asaasCustomerId: "cus_legacy_1",
  asaasCustomerAccount: "legacy" as const,
  asaasSubscriptionId: "sub_legacy_1",
  asaasSubscriptionAccount: "legacy" as const,
  subscriptionStatus: "active",
  subscriptionNextDueDate: null,
  subscriptionCycle: "MONTHLY",
  hasPermanentSubscription: false,
  hasUnlimitedUsers: false,
  timezone: "America/Sao_Paulo",
}

describe("IncrementalBillingService — roteamento por conta e fim do self-heal (E2)", () => {
  beforeEach(() => {
    requestLog.length = 0
    requestImplByAccount.primary = async () => ({ id: "sub_primary" })
    requestImplByAccount.legacy = async () => ({ id: "sub_legacy" })
    createCustomerMock.mockClear()
    updateAsaasCustomerIdMock.mockClear()
    updateSubscriptionDataMock.mockClear()
    asaasFetchMock.mockClear()
    paymentCreatePixMock.mockClear()
    cardCreateMock.mockClear()
    sessionCreateMock.mockClear()
    attemptCreateMock.mockClear()
    leaseMock.mockClear()
    updateAttemptMock.mockClear()
    attachProviderAttemptMock.mockClear()
  })

  it("T-40.4: PIX de add-on vai ao AbacatePay e não toca o Asaas (customer nem assinatura)", async () => {
    const service = new IncrementalBillingService()

    const result = await service.createIncrementalCharge({
      master: baseMaster,
      pendingActionId: "pa-1",
      amount: 10,
      description: "teste",
      billingType: "PIX",
    })

    expect(paymentCreatePixMock).toHaveBeenCalledTimes(1)
    expect(requestLog).toHaveLength(0)
    expect(createCustomerMock).not.toHaveBeenCalled()
    expect(updateAsaasCustomerIdMock).not.toHaveBeenCalled()
    expect(attachProviderAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pa-1", provider: "ABACATE_PAY", providerExternalId: "bill_1" })
    )
    expect(result.paymentId).toBe("provider-bill_1")
    expect(result.pix?.payload).toBe("copia-cola")
  })

  it("T-40.5: cartão de add-on sem token é recusado antes de qualquer escrita ou chamada ao provedor", async () => {
    const service = new IncrementalBillingService()

    await expect(
      service.createIncrementalCharge({
        master: baseMaster,
        pendingActionId: "pa-2",
        amount: 50,
        description: "cobrança cartão",
        billingType: "CREDIT_CARD",
      })
    ).rejects.toThrow(/Token do cartão ausente/)

    expect(cardCreateMock).not.toHaveBeenCalled()
    expect(paymentCreatePixMock).not.toHaveBeenCalled()
    expect(sessionCreateMock).not.toHaveBeenCalled()
    expect(requestLog).toHaveLength(0)
  })

  it("T-40.9: cartão com token ctok_ cobra pelo AbacatePay com o token recebido, sem tocar no Asaas", async () => {
    cardCreateMock.mockImplementationOnce(async () => ({
      status: "PENDING",
      externalId: "bill_card",
      method: "CARD",
      amountInCents: 5000,
      currency: "BRL",
    }))

    const service = new IncrementalBillingService()

    await service.createIncrementalCharge({
      master: baseMaster,
      pendingActionId: "pa-5",
      amount: 50,
      description: "cobrança cartão",
      billingType: "CREDIT_CARD",
      cardToken: "ctok_abc",
      installments: 3,
    })

    expect(cardCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "ctok_abc", installments: 3, tokenIssuedAt: expect.any(Date) })
    )
    expect(paymentCreatePixMock).not.toHaveBeenCalled()
    expect(requestLog).toHaveLength(0)
    expect(createCustomerMock).not.toHaveBeenCalled()
  })

  it("T-40.6: GET/PUT/DELETE de assinatura usam o transporte da asaasSubscriptionAccount (legacy)", async () => {
    requestImplByAccount.legacy = async (url: string) => {
      if (url.includes("/customers?")) return {}
      if (url.includes("/subscriptions?")) {
        return { id: "sub_legacy_1", billingType: "PIX", cycle: "MONTHLY" }
      }
      return {}
    }

    const service = new IncrementalBillingService()

    await service.syncRecurringSubscription({
      master: baseMaster,
      targetRecurringTotal: 199,
      reason: "teste roteamento",
    })

    const subscriptionCalls = requestLog.filter((call) => call.url.includes("/subscriptions?"))
    expect(subscriptionCalls.length).toBeGreaterThan(0)
    expect(subscriptionCalls.every((call) => call.account === "legacy")).toBe(true)
    // nenhuma chamada de assinatura vazou para o transporte primary
    expect(requestLog.some((call) => call.url.includes("/subscriptions?") && call.account === "primary")).toBe(
      false
    )
  })

  it("achado P1 PRRT_...CUk4: syncRecurringSubscription com override de data grava a MESMA conta da assinatura reaproveitada (legacy)", async () => {
    requestImplByAccount.legacy = async (url: string) => {
      if (url.includes("/customers?")) return {}
      if (url.includes("/subscriptions?")) {
        return { id: "sub_legacy_1", billingType: "PIX", cycle: "MONTHLY" }
      }
      return {}
    }

    const service = new IncrementalBillingService()

    await service.syncRecurringSubscription({
      master: baseMaster,
      targetRecurringTotal: 199,
      reason: "teste override de data",
      nextDueDateOverride: new Date("2026-12-01T00:00:00.000Z"),
    })

    expect(updateSubscriptionDataMock).toHaveBeenCalledWith(
      baseMaster.id,
      expect.objectContaining({
        asaasSubscriptionId: "sub_legacy_1",
        asaasSubscriptionAccount: "legacy",
      })
    )
  })

  it("controle negativo: mesmo fluxo com assinatura já primary continua gravando primary (não regride o caminho comum)", async () => {
    requestImplByAccount.primary = async (url: string) => {
      if (url.includes("/customers?")) return {}
      if (url.includes("/subscriptions?")) {
        return { id: "sub_primary_1", billingType: "PIX", cycle: "MONTHLY" }
      }
      return {}
    }
    const primaryMaster = {
      ...baseMaster,
      asaasCustomerAccount: "primary" as const,
      asaasSubscriptionAccount: "primary" as const,
      asaasSubscriptionId: "sub_primary_1",
    }

    const service = new IncrementalBillingService()

    await service.syncRecurringSubscription({
      master: primaryMaster,
      targetRecurringTotal: 199,
      reason: "teste override de data",
      nextDueDateOverride: new Date("2026-12-01T00:00:00.000Z"),
    })

    expect(updateSubscriptionDataMock).toHaveBeenCalledWith(
      primaryMaster.id,
      expect.objectContaining({
        asaasSubscriptionId: "sub_primary_1",
        asaasSubscriptionAccount: "primary",
      })
    )
  })

  it("T-40.8: fallback de ensureOrSyncRecurringSubscription não cria assinatura nova para sub legacy nem sobrescreve asaasSubscriptionId", async () => {
    const legacyPlaceholderMaster = {
      ...baseMaster,
      asaasSubscriptionId: "adhesion-legacy-1", // isRealAsaasSubscriptionId() = false
      asaasSubscriptionAccount: "legacy" as const,
    }

    const service = new IncrementalBillingService()

    await expect(
      service.ensureOrSyncRecurringSubscription({
        master: legacyPlaceholderMaster,
        targetRecurringTotal: 100,
        reason: "teste fallback",
        defaultBillingType: "PIX",
      })
    ).rejects.toThrow(/conta legacy/)

    expect(updateSubscriptionDataMock).not.toHaveBeenCalled()
    const subscriptionCreateCalls = (
      asaasFetchMock.mock.calls as unknown as Array<[string, RequestInit?]>
    ).filter(([url, init]) => url.includes("/subscriptions") && init?.method === "POST")
    expect(subscriptionCreateCalls).toHaveLength(0)
  })
})
