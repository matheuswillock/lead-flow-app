import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-40.4 a T-40.8 de [[40 — Checkout, Adesões e Add-ons — Backend]] (E2):
// ensureCustomer nunca recria em erro (DA1); GET/PUT/DELETE de assinatura
// roteiam pela conta do master; cartão de assinatura legacy é bloqueado.

const createCustomerMock = mock(async (_input: unknown) => ({ id: "cus_gateway" }))
const updateAsaasCustomerIdMock = mock(async () => {})
const updateSubscriptionDataMock = mock(async () => {})
const getBillingSnapshotMock = mock(async () => null)
const getSubscriptionEndDateMock = mock(async () => null)

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

function statusError(statusCode: number, message = "erro"): Error {
  const error = new Error(message)
  ;(error as { statusCode?: number }).statusCode = statusCode
  return error
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
  })

  it("T-40.4: 404 em cus_ legacy não recria, não chama updateAsaasCustomerId, roteia GET para o transporte legacy", async () => {
    requestImplByAccount.legacy = async () => {
      throw statusError(404, "Customer not found")
    }

    const service = new IncrementalBillingService()

    await expect(
      service.createIncrementalCharge({
        master: baseMaster,
        pendingActionId: "pa-1",
        amount: 10,
        description: "teste",
        billingType: "PIX",
      })
    ).rejects.toThrow(/não pôde ser lido/)

    expect(createCustomerMock).not.toHaveBeenCalled()
    expect(updateAsaasCustomerIdMock).not.toHaveBeenCalled()

    const customerGet = requestLog.find((call) => call.url.includes("/customers?"))
    expect(customerGet?.account).toBe("legacy")
  })

  it("T-40.5: erro != 404 (500) também propaga e não recria, para qualquer conta", async () => {
    requestImplByAccount.legacy = async () => {
      throw statusError(500, "Internal error")
    }

    const service = new IncrementalBillingService()

    await expect(
      service.createIncrementalCharge({
        master: baseMaster,
        pendingActionId: "pa-2",
        amount: 10,
        description: "teste",
        billingType: "PIX",
      })
    ).rejects.toThrow(/não pôde ser lido/)

    expect(createCustomerMock).not.toHaveBeenCalled()
    expect(updateAsaasCustomerIdMock).not.toHaveBeenCalled()
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

  it("T-40.7: cobrança CREDIT_CARD com assinatura legacy é recusada com mensagem de reautorização; PIX segue permitido", async () => {
    requestImplByAccount.legacy = async (url: string) => {
      if (url.includes("/customers?")) return {}
      if (url.includes("/subscriptions?")) {
        return {
          id: "sub_legacy_1",
          billingType: "CREDIT_CARD",
          cycle: "MONTHLY",
          creditCard: { creditCardToken: "tok_legacy" },
        }
      }
      return {}
    }

    const service = new IncrementalBillingService()

    await expect(
      service.createIncrementalCharge({
        master: baseMaster,
        pendingActionId: "pa-3",
        amount: 50,
        description: "cobrança cartão",
        billingType: "CREDIT_CARD",
      })
    ).rejects.toThrow(/reautorização/)

    // PIX não toca getCurrentSubscription — não é bloqueado
    requestImplByAccount.primary = async (url: string) => {
      if (url.includes("/payments?")) return { id: "pay_1", status: "PENDING" }
      if (url.includes("/pixQrCode")) return { encodedImage: "img", payload: "copia-cola", expirationDate: "" }
      return {}
    }
    const primaryMaster = {
      ...baseMaster,
      asaasCustomerAccount: "primary" as const,
      asaasSubscriptionAccount: "primary" as const,
    }

    const pixResult = await service.createIncrementalCharge({
      master: primaryMaster,
      pendingActionId: "pa-4",
      amount: 50,
      description: "cobrança pix",
      billingType: "PIX",
    })

    expect(pixResult.billingType).toBe("PIX")
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
