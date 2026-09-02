import { beforeEach, describe, expect, it, mock } from "bun:test"

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

const asaasFetchMock = mock(async (_url: string, _init?: RequestInit) => ({
  id: "sub_new",
  nextDueDate: "2026-09-10",
  cycle: "MONTHLY",
}))

const endpoints = {
  subscriptions: "https://sandbox.asaas.com/api/v3/subscriptions",
  customers: "https://sandbox.asaas.com/api/v3/customers",
  payments: "https://sandbox.asaas.com/api/v3/payments",
  pixQrCode: (id: string) => `https://sandbox.asaas.com/api/v3/payments/${id}/pixQrCode`,
}

mock.module("@/lib/asaas", () => ({
  asaasApi: endpoints,
  asaasFetch: asaasFetchMock,
  createAsaasClient: (_accountId: string) => ({
    endpoints,
    request: asaasFetchMock,
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
  asaasCustomerId: null,
  asaasCustomerAccount: "primary" as const,
  asaasSubscriptionId: null,
  asaasSubscriptionAccount: "primary" as const,
  subscriptionStatus: null,
  subscriptionNextDueDate: null,
  subscriptionCycle: null,
  hasPermanentSubscription: false,
  hasUnlimitedUsers: false,
  timezone: "America/Sao_Paulo",
}

describe("IncrementalBillingService — criação de customer via gateway (E5)", () => {
  beforeEach(() => {
    createCustomerMock.mockClear()
    updateAsaasCustomerIdMock.mockClear()
    asaasFetchMock.mockClear()
    createCustomerMock.mockImplementation(async () => ({ id: "cus_gateway" }))
    asaasFetchMock.mockImplementation(async () => ({
      id: "sub_new",
      nextDueDate: "2026-09-10",
      cycle: "MONTHLY",
    }))
  })

  it("master sem asaasCustomerId → ensureOrSyncRecurringSubscription cria customer via AsaasCustomerGateway, nunca via POST /customers direto", async () => {
    const service = new IncrementalBillingService()

    await service.ensureOrSyncRecurringSubscription({
      master: baseMaster,
      targetRecurringTotal: 100,
      reason: "teste E5",
      defaultBillingType: "PIX",
    })

    expect(createCustomerMock).toHaveBeenCalledTimes(1)
    expect(createCustomerMock).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "profile-master-1", name: "Master Teste" })
    )
    expect(updateAsaasCustomerIdMock).toHaveBeenCalledWith("profile-master-1", "cus_gateway")

    // Nenhuma chamada a asaasFetch(asaasApi.customers, ...) — só a de
    // subscriptions (criação da assinatura recorrente).
    const customerPostCalls = (
      asaasFetchMock.mock.calls as unknown as Array<[string, RequestInit?]>
    ).filter(([url]) => url.includes("/customers"))
    expect(customerPostCalls).toHaveLength(0)
  })

  it("achado cursor[bot] (PR #1137, P1, round 12): master com customer legacy válido não envia o cus_ antigo para createAsaasSubscription (primary-only) — resolve par novo via gateway", async () => {
    const legacyMaster = {
      ...baseMaster,
      asaasCustomerId: "cus_legacy_1",
      asaasCustomerAccount: "legacy" as const,
    }
    const service = new IncrementalBillingService()

    await service.ensureOrSyncRecurringSubscription({
      master: legacyMaster,
      targetRecurringTotal: 100,
      reason: "teste round 12",
      defaultBillingType: "PIX",
    })

    // ensureCustomer valida o cus_ legacy (GET via createAsaasClient) —
    // válido, mas não serve para uma criação que só existe na primary.
    expect(createCustomerMock).toHaveBeenCalledTimes(1)
    expect(createCustomerMock).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "profile-master-1" })
    )
    expect(updateAsaasCustomerIdMock).toHaveBeenCalledWith("profile-master-1", "cus_gateway")

    const subscriptionPostBody = JSON.parse(
      (asaasFetchMock.mock.calls.find(
        ([url, init]) => url.includes("/subscriptions") && (init as RequestInit)?.method === "POST"
      )?.[1] as RequestInit).body as string
    )
    expect(subscriptionPostBody.customer).toBe("cus_gateway")
    expect(subscriptionPostBody.customer).not.toBe("cus_legacy_1")
  })
})
