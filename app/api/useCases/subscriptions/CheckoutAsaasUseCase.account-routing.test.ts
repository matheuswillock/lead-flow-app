import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

mock.module("@/lib/utils/app-url", () => ({
  getFullUrl: (path: string) => `https://example.test${path}`,
}))

mock.module("@/lib/cache/invalidation", () => ({
  invalidateAccountAccessStatusCache: () => {},
}))

// T-40.13/T-40.14 de [[40 — Checkout, Adesões e Add-ons — Backend]] (E4/C22):
// operador não fica "pago sem entrega" — GET/PUT da assinatura antiga do
// manager roteiam por conta; checkout novo com cus_ legado passa pelo gateway.

const requestLog: Array<{ account: string; url: string; method?: string }> = []
const requestImplByAccount: Record<string, (url: string, method?: string) => Promise<any>> = {}

function endpointsFor(accountId: string) {
  return {
    customers: `https://sandbox.asaas.com/api/v3/customers?account=${accountId}`,
    subscriptions: `https://sandbox.asaas.com/api/v3/subscriptions?account=${accountId}`,
    payments: `https://sandbox.asaas.com/api/v3/payments?account=${accountId}`,
    checkouts: `https://sandbox.asaas.com/api/v3/checkouts?account=${accountId}`,
  }
}

const asaasFetchMock = mock(async (_url: string, _init?: RequestInit) => ({ id: "checkout_1" }))

mock.module("@/lib/asaas", () => ({
  asaasApi: endpointsFor("primary"),
  asaasFetch: asaasFetchMock,
  createAsaasClient: (accountId: "primary" | "legacy") => ({
    endpoints: endpointsFor(accountId),
    request: async (url: string, init?: RequestInit) => {
      requestLog.push({ account: accountId, url, method: init?.method })
      const impl = requestImplByAccount[accountId]
      if (!impl) throw new Error(`sem mock de request configurado para a conta ${accountId}`)
      return impl(url, init?.method)
    },
  }),
}))

mock.module("@/lib/supabase/server", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        createUser: async () => ({
          data: { user: { id: "supabase-operator-1" } },
          error: null,
        }),
      },
    },
  }),
}))

mock.module("@/lib/services/EmailService", () => ({
  getEmailService: () => ({
    sendOperatorInviteEmail: async () => {},
    sendWelcomeEmail: async () => {},
  }),
}))

const { CheckoutAsaasUseCase } = await import("./CheckoutAsaasUseCase")

const manager = {
  id: "manager-1",
  supabaseId: "sb-manager-1",
  role: "manager",
  subscriptionStatus: "active",
  asaasCustomerId: "cus_legacy_1",
  asaasCustomerAccount: "legacy" as const,
  asaasSubscriptionId: "sub_legacy_1",
  asaasSubscriptionAccount: "legacy" as const,
  fullName: "Manager Teste",
  email: "manager@example.test",
  cpfCnpj: null,
  phone: null,
  postalCode: null,
  address: null,
  addressNumber: null,
  neighborhood: null,
  complement: null,
  timezone: "America/Sao_Paulo",
} as any

function fakeRepos(overrides: Record<string, any> = {}) {
  const profileRepository = {
    findBySupabaseId: mock(async () => manager),
    findByEmail: mock(async () => null),
    updateAsaasCustomerId: mock(async () => {}),
    activateSubscription: mock(async () => {}),
    createOperatorProfileFromPendingOperator: mock(async () => ({
      id: "operator-1",
      email: "novo-operador@example.test",
    })),
    incrementOperatorCount: mock(async () => {}),
    findByAsaasSubscriptionIdAndAccount: mock(async () => null),
    ...overrides.profileRepository,
  }
  const teamRepository = {
    findMasterRef: mock(async () => ({ masterId: manager.id })),
    findDefaultTeamIdByMaster: mock(async () => "team-1"),
    ...overrides.teamRepository,
  }
  const teamMembersRepository = {
    findExistingMember: mock(async () => null),
    createMember: mock(async () => {}),
    ...overrides.teamMembersRepository,
  }
  const pendingOperatorRepository = {
    create: mock(async () => ({ id: "pending-op-1" })),
    findByPaymentIdWithManager: mock(async () => ({
      id: "pending-op-1",
      managerId: manager.id,
      teamId: "team-1",
      name: "Novo Operador",
      email: "novo-operador@example.test",
      role: "operator",
      functions: [],
      paymentId: "checkout_session_1",
      subscriptionId: "sub_new_1",
      paymentStatus: "PENDING",
      paymentMethod: "UNDEFINED",
      operatorCreated: false,
      operatorId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      manager,
    })),
    updatePaymentId: mock(async () => {}),
    markSubscriptionUpdated: mock(async () => {}),
    deleteById: mock(async () => {}),
    ...overrides.pendingOperatorRepository,
  }
  const asaasCustomerGateway = {
    createCustomer: mock(async () => ({ id: "cus_new_primary" })),
    ...overrides.asaasCustomerGateway,
  }

  return { profileRepository, teamRepository, teamMembersRepository, pendingOperatorRepository, asaasCustomerGateway }
}

describe("CheckoutAsaasUseCase — operador não fica pago-sem-entrega (E4/C22)", () => {
  beforeEach(() => {
    requestLog.length = 0
    requestImplByAccount.primary = async (_url: string, method?: string) => {
      if (method === "GET") return { value: 100, subscription: "sub_new_1" }
      return { id: "checkout_1" }
    }
    requestImplByAccount.legacy = async (_url: string, method?: string) => {
      if (method === "GET") return { value: 100 }
      return {}
    }
  })

  it("T-40.13: processOperatorCheckoutPaid com sub legacy roteia GET/PUT pelo transporte legacy; operador é criado", async () => {
    const repos = fakeRepos()
    const useCase = new CheckoutAsaasUseCase(
      repos.profileRepository,
      repos.teamRepository,
      repos.teamMembersRepository,
      repos.pendingOperatorRepository,
      repos.asaasCustomerGateway
    )

    const result = await useCase.processOperatorCheckoutPaid("checkout_session_1", "pay_1", "primary")

    expect(result.isValid).toBe(true)
    expect(repos.profileRepository.createOperatorProfileFromPendingOperator).toHaveBeenCalledTimes(1)

    const oldSubGetPut = requestLog.filter(
      (c) => c.account === "legacy" && c.url.includes("/subscriptions?") && (c.method === "GET" || c.method === "PUT")
    )
    expect(oldSubGetPut.length).toBeGreaterThan(0)
    // a busca do payment/cancelamento da subscription nova é na conta do evento (primary)
    const newSubDelete = requestLog.filter(
      (c) => c.account === "primary" && c.url.includes("/subscriptions?") && c.method === "DELETE"
    )
    expect(newSubDelete.length).toBeGreaterThan(0)
  })

  it("achado Codex (PR #1137, P1): retentativa após incremento aplicado não soma +19,90 de novo", async () => {
    const repos = fakeRepos({
      pendingOperatorRepository: {
        findByPaymentIdWithManager: mock(async () => ({
          id: "pending-op-1",
          managerId: manager.id,
          teamId: "team-1",
          name: "Novo Operador",
          email: "novo-operador@example.test",
          role: "operator",
          functions: [],
          paymentId: "checkout_session_1",
          subscriptionId: "sub_new_1",
          // marcador já setado por uma tentativa anterior que falhou depois do PUT
          paymentStatus: "SUBSCRIPTION_UPDATED",
          paymentMethod: "UNDEFINED",
          operatorCreated: false,
          operatorId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          manager,
        })),
      },
    })
    const useCase = new CheckoutAsaasUseCase(
      repos.profileRepository,
      repos.teamRepository,
      repos.teamMembersRepository,
      repos.pendingOperatorRepository,
      repos.asaasCustomerGateway
    )

    const result = await useCase.processOperatorCheckoutPaid("checkout_session_1", "pay_1", "primary")

    expect(result.isValid).toBe(true)
    const oldSubPut = requestLog.filter(
      (c) => c.account === "legacy" && c.url.includes("/subscriptions?") && c.method === "PUT"
    )
    expect(oldSubPut).toHaveLength(0)
    expect(repos.pendingOperatorRepository.markSubscriptionUpdated).not.toHaveBeenCalled()
  })

  it("T-40.14: createOperatorCheckout com cus_ legacy não envia o ID antigo — resolve par novo via gateway", async () => {
    const repos = fakeRepos()
    const useCase = new CheckoutAsaasUseCase(
      repos.profileRepository,
      repos.teamRepository,
      repos.teamMembersRepository,
      repos.pendingOperatorRepository,
      repos.asaasCustomerGateway
    )

    const result = await useCase.createOperatorCheckout({
      managerId: manager.supabaseId,
      operatorData: { name: "Novo", email: "novo@example.test", role: "operator" },
    })

    expect(result.isValid).toBe(true)
    expect(repos.asaasCustomerGateway.createCustomer).toHaveBeenCalledTimes(1)
    expect(repos.profileRepository.updateAsaasCustomerId).toHaveBeenCalledWith(manager.id, "cus_new_primary")

    const checkoutCall = asaasFetchMock.mock.calls.find(([url]) => String(url).includes("/checkouts"))
    expect(checkoutCall).toBeDefined()
    const body = JSON.parse((checkoutCall?.[1] as RequestInit)?.body as string)
    expect(body.customer).toBe("cus_new_primary")
    expect(body.customer).not.toBe(manager.asaasCustomerId)
  })
})
