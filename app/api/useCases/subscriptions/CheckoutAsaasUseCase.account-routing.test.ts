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

const createUserMock = mock(async () => ({
  data: { user: { id: "supabase-operator-1" } as { id: string } | null },
  error: null as { code?: string; message?: string } | null,
}))
const generateLinkMock = mock(async () => ({
  data: { user: null as { id: string } | null },
  error: null as { message?: string } | null,
}))

const createSupabaseAdminMock = mock(() => ({
  auth: {
    admin: {
      createUser: createUserMock,
      generateLink: generateLinkMock,
    },
  },
}))

mock.module("@/lib/supabase/server", () => ({
  createSupabaseAdmin: createSupabaseAdminMock,
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
    findActiveByManagerAndEmail: mock(async () => null),
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
    createSupabaseAdminMock.mockClear()
    createUserMock.mockClear()
    createUserMock.mockImplementation(async () => ({
      data: { user: { id: "supabase-operator-1" } },
      error: null,
    }))
    generateLinkMock.mockClear()
    requestImplByAccount.primary = async (_url: string, method?: string) => {
      if (method === "GET") return { value: 100, subscription: "sub_new_1" }
      return { id: "checkout_1" }
    }
    requestImplByAccount.legacy = async (_url: string, method?: string) => {
      if (method === "GET") return { value: 100 }
      return {}
    }
  })

  it("achado Codex (PR #1137, P1, round 7): findByPaymentIdWithManager filtra pela conta do evento, não só pelo checkoutSessionId", async () => {
    const findByPaymentIdWithManagerMock = mock(async (_checkoutSessionId: string, account: string) =>
      account === "primary"
        ? {
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
          }
        : null
    )
    const repos = fakeRepos({
      pendingOperatorRepository: { findByPaymentIdWithManager: findByPaymentIdWithManagerMock },
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
    expect(findByPaymentIdWithManagerMock).toHaveBeenCalledWith("checkout_session_1", "primary")
  })

  it("achado Codex (PR #1137, P1, round 7): checkoutSessionId colidindo entre contas não aplica o pendingOperator errado", async () => {
    const findByPaymentIdWithManagerMock = mock(async () => null)
    const repos = fakeRepos({
      pendingOperatorRepository: { findByPaymentIdWithManager: findByPaymentIdWithManagerMock },
    })
    const useCase = new CheckoutAsaasUseCase(
      repos.profileRepository,
      repos.teamRepository,
      repos.teamMembersRepository,
      repos.pendingOperatorRepository,
      repos.asaasCustomerGateway
    )

    // Evento é da conta legacy, mas o checkoutSessionId só existe (por
    // colisão) na primary — sem filtro por conta, o findFirst do
    // repositório aplicaria o pendingOperator errado.
    const result = await useCase.processOperatorCheckoutPaid("checkout_session_1", "pay_1", "legacy")

    expect(result.isValid).toBe(false)
    expect(findByPaymentIdWithManagerMock).toHaveBeenCalledWith("checkout_session_1", "legacy")
    expect(repos.teamMembersRepository.createMember).not.toHaveBeenCalled()
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

  it("achado cursor[bot] (PR #1137, P1): marca SUBSCRIPTION_UPDATED ANTES do PUT, não depois", async () => {
    const callOrder: string[] = []
    const repos = fakeRepos({
      pendingOperatorRepository: {
        markSubscriptionUpdated: mock(async () => {
          callOrder.push("mark")
        }),
      },
    })
    requestImplByAccount.legacy = async (_url: string, method?: string) => {
      if (method === "PUT") callOrder.push("put")
      if (method === "GET") return { value: 100 }
      return {}
    }
    const useCase = new CheckoutAsaasUseCase(
      repos.profileRepository,
      repos.teamRepository,
      repos.teamMembersRepository,
      repos.pendingOperatorRepository,
      repos.asaasCustomerGateway
    )

    await useCase.processOperatorCheckoutPaid("checkout_session_1", "pay_1", "primary")

    expect(callOrder).toEqual(["mark", "put"])
  })

  it("achado Codex (PR #1137, P1): perfil já existe para o e-mail, criado por ESTA mesma execução (retry pós-criação) → retoma sem recriar usuário", async () => {
    const existingOperatorProfile = {
      id: "operator-existing-1",
      email: "novo-operador@example.test",
      managerId: manager.id,
    }
    const repos = fakeRepos({
      profileRepository: {
        findByEmail: mock(async () => existingOperatorProfile),
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
    expect(createSupabaseAdminMock).not.toHaveBeenCalled()
    expect(repos.profileRepository.createOperatorProfileFromPendingOperator).not.toHaveBeenCalled()
    expect(repos.teamMembersRepository.createMember).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "operator-existing-1" })
    )
    // idempotência preservada: incrementa o contador exatamente uma vez, com ou sem resume
    expect(repos.profileRepository.incrementOperatorCount).toHaveBeenCalledTimes(1)
  })

  it("achado Codex/cursor[bot] (PR #1137, P1, round 6): perfil com o e-mail existe mas NÃO foi criado por este checkout (managerId diferente) → não concede membership", async () => {
    const unrelatedProfile = {
      id: "operator-unrelated-1",
      email: "novo-operador@example.test",
      managerId: "outro-manager-9",
    }
    const repos = fakeRepos({
      profileRepository: {
        findByEmail: mock(async () => unrelatedProfile),
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

    expect(result.isValid).toBe(false)
    expect(createSupabaseAdminMock).not.toHaveBeenCalled()
    expect(repos.teamMembersRepository.createMember).not.toHaveBeenCalled()
    expect(repos.profileRepository.incrementOperatorCount).not.toHaveBeenCalled()
  })

  it("achado Codex (PR #1137, P1, follow-up): createUser retornou email_exists (Auth criado por ESTA execução, profile não) → recupera identidade via generateLink em vez de falhar para sempre", async () => {
    createUserMock.mockImplementation(async () => ({
      data: { user: null },
      error: { code: "email_exists", message: "Email already registered" },
    }))
    generateLinkMock.mockImplementation(async () => ({
      data: {
        user: {
          id: "supabase-operator-existing-auth-1",
          user_metadata: { manager_id: manager.supabaseId },
        },
      },
      error: null,
    }))
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
    expect(generateLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "recovery", email: "novo-operador@example.test" })
    )
    expect(repos.profileRepository.createOperatorProfileFromPendingOperator).toHaveBeenCalledWith(
      expect.objectContaining({ supabaseId: "supabase-operator-existing-auth-1" })
    )
  })

  it("achado Codex/cursor[bot] (PR #1137, P1, round 6): generateLink recupera identidade do Auth sem relação com este checkout → não concede membership", async () => {
    createUserMock.mockImplementation(async () => ({
      data: { user: null },
      error: { code: "email_exists", message: "Email already registered" },
    }))
    generateLinkMock.mockImplementation(async () => ({
      data: {
        user: {
          id: "supabase-operator-unrelated-auth-1",
          user_metadata: { manager_id: "outro-manager-supabase-id" },
        },
      },
      error: null,
    }))
    const repos = fakeRepos()
    const useCase = new CheckoutAsaasUseCase(
      repos.profileRepository,
      repos.teamRepository,
      repos.teamMembersRepository,
      repos.pendingOperatorRepository,
      repos.asaasCustomerGateway
    )

    const result = await useCase.processOperatorCheckoutPaid("checkout_session_1", "pay_1", "primary")

    expect(result.isValid).toBe(false)
    expect(repos.profileRepository.createOperatorProfileFromPendingOperator).not.toHaveBeenCalled()
    expect(repos.teamMembersRepository.createMember).not.toHaveBeenCalled()
  })

  it("achado Codex (PR #1137, P1, round 8): já existe checkout ativo para o e-mail — bloqueia o segundo antes de qualquer pagamento", async () => {
    const repos = fakeRepos({
      pendingOperatorRepository: {
        findActiveByManagerAndEmail: mock(async () => ({ id: "pending-op-existing", createdAt: new Date() })),
      },
    })
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

    expect(result.isValid).toBe(false)
    expect(repos.pendingOperatorRepository.create).not.toHaveBeenCalled()
  })

  it("achado Codex (PR #1137, P1, round 8): checkout ativo mas expirado (>24h) não bloqueia um novo", async () => {
    const repos = fakeRepos({
      pendingOperatorRepository: {
        findActiveByManagerAndEmail: mock(async () => ({
          id: "pending-op-expired",
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
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

    const result = await useCase.createOperatorCheckout({
      managerId: manager.supabaseId,
      operatorData: { name: "Novo", email: "novo@example.test", role: "operator" },
    })

    expect(result.isValid).toBe(true)
    expect(repos.pendingOperatorRepository.create).toHaveBeenCalledTimes(1)
  })

  it("achado Codex (PR #1137, P1, round 9): violação do índice único parcial (race de criação concorrente) vira mensagem amigável, não 500", async () => {
    const repos = fakeRepos({
      pendingOperatorRepository: {
        create: mock(async () => {
          throw new Error("DUPLICATE_ACTIVE_CHECKOUT")
        }),
      },
    })
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

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual(["Já existe um checkout pendente para este e-mail"])
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
