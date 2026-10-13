import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

mock.module("@/lib/supabase/server", () => ({
  createSupabaseAdmin: () => null,
}))

mock.module("@/lib/services/EmailService", () => ({
  EmailService: class {},
  createEmailService: () => ({}),
  getEmailService: () => ({ sendWelcomeEmail: async () => {} }),
  emailService: {},
}))

mock.module("@/lib/utils/app-url", () => ({
  getFullUrl: (path: string) => `https://example.test${path}`,
}))

mock.module("@/lib/cache/invalidation", () => ({
  invalidateAccountAccessStatusCache: () => {},
}))

// C33: processCheckoutPaid recebe a conta do evento (`account`), mas até
// aqui buscava a cobrança sempre via asaasFetch/asaasApi — cliente fixo na
// conta primary. Para um evento legacy (default de todo dado pré-migration),
// a busca ia na conta errada: 404, ou pior, lê o ID de outra conta (achado
// cursor[bot] no PR #1100, RUN_ID bc-689f4ee9).
const requestMock = mock(async (_endpoint: string, _init?: RequestInit): Promise<any> => ({
  subscription: "sub_legacy_1",
}))
const createAsaasClientMock = mock((accountId: string) => ({
  endpoints: {
    payments: `https://asaas.test/${accountId}/payments`,
    subscriptions: `https://asaas.test/${accountId}/subscriptions`,
  },
  request: requestMock,
}))
const asaasFetchMock = mock(async () => {
  throw new Error("asaasFetch (conta fixa primary) não deveria ser chamado por processCheckoutPaid")
})
mock.module("@/lib/asaas", () => ({
  asaasFetch: asaasFetchMock,
  asaasApi: { payments: "https://asaas.test/primary/payments" },
  createAsaasClient: createAsaasClientMock,
}))

const { CheckoutAsaasUseCase } = await import("./CheckoutAsaasUseCase")

describe("CheckoutAsaasUseCase.processCheckoutPaid — busca a cobrança na conta do evento (C33)", () => {
  let findByAsaasSubscriptionIdAndAccountMock: ReturnType<typeof mock>
  let findByAsaasCustomerIdAndAccountMock: ReturnType<typeof mock>
  let activateSubscriptionMock: ReturnType<typeof mock>
  let updateSubscriptionAfterCheckoutMock: ReturnType<typeof mock>

  beforeEach(() => {
    requestMock.mockClear()
    requestMock.mockImplementation(async (_endpoint: string, _init?: RequestInit) => ({
      subscription: "sub_legacy_1",
    }))
    createAsaasClientMock.mockClear()
    asaasFetchMock.mockClear()
    findByAsaasSubscriptionIdAndAccountMock = mock(async () => ({
      id: "profile-1",
      supabaseId: "sb-1",
      email: "fulano@example.test",
      fullName: "Fulano de Tal",
    }))
    findByAsaasCustomerIdAndAccountMock = mock(async () => null)
    activateSubscriptionMock = mock(async () => {})
    updateSubscriptionAfterCheckoutMock = mock(async () => {})
  })

  function buildUseCase() {
    const profileRepository = {
      findByAsaasSubscriptionIdAndAccount: findByAsaasSubscriptionIdAndAccountMock,
      findByAsaasCustomerIdAndAccount: findByAsaasCustomerIdAndAccountMock,
      updateSubscriptionAfterCheckout: updateSubscriptionAfterCheckoutMock,
      activateSubscription: activateSubscriptionMock,
    } as any
    return new CheckoutAsaasUseCase(
      profileRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { resolvePrice: mock(async () => 102.9) } as any,
    )
  }

  it("evento da conta legacy → busca a cobrança via createAsaasClient('legacy'), nunca via asaasFetch fixo", async () => {
    const useCase = buildUseCase()

    const result = await useCase.processCheckoutPaid("checkout_1", "legacy")

    expect(result.isValid).toBe(true)
    expect(createAsaasClientMock).toHaveBeenCalledWith("legacy")
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock.mock.calls[0][0]).toContain("/legacy/payments/checkout_1")
    expect(asaasFetchMock).not.toHaveBeenCalled()
    expect(findByAsaasSubscriptionIdAndAccountMock).toHaveBeenCalledWith("sub_legacy_1", "legacy")
  })

  it("evento da conta primary → busca via createAsaasClient('primary')", async () => {
    const useCase = buildUseCase()

    await useCase.processCheckoutPaid("checkout_2", "primary")

    expect(createAsaasClientMock).toHaveBeenCalledWith("primary")
    expect(requestMock.mock.calls[0][0]).toContain("/primary/payments/checkout_2")
  })

  it("pagamento detached confirmado → cria assinatura mensal com preço do catálogo e é idempotente", async () => {
    let detachedSubscriptionCreated = false
    requestMock.mockImplementation(async (endpoint: string, init?: RequestInit) => {
      if (endpoint.includes("/payments/")) {
        return { id: "payment_1", customer: "cus_primary", value: 102.9, billingType: "CREDIT_CARD" }
      }
      if (endpoint.includes("externalReference=checkout%3Apayment_1")) {
        return detachedSubscriptionCreated
          ? { data: [{ id: "sub_primary", customer: "cus_primary", value: 102.9, cycle: "MONTHLY", status: "ACTIVE" }] }
          : { data: [] }
      }
      if (init?.method === "POST") {
        detachedSubscriptionCreated = true
        return {
          id: "sub_primary",
          customer: "cus_primary",
          value: 102.9,
          billingType: "CREDIT_CARD",
          cycle: "MONTHLY",
          status: "ACTIVE",
          nextDueDate: "2026-11-12",
        }
      }
      return { data: [] }
    })
    findByAsaasSubscriptionIdAndAccountMock.mockResolvedValue(null)
    findByAsaasCustomerIdAndAccountMock.mockResolvedValue({
      id: "profile-1",
      supabaseId: "sb-1",
      email: "fulano@example.test",
      fullName: "Fulano de Tal",
      timezone: "America/Sao_Paulo",
    })

    const result = await buildUseCase().processCheckoutPaid("payment_1", "primary")
    const secondResult = await buildUseCase().processCheckoutPaid("payment_1", "primary")

    expect(result.isValid).toBe(true)
    expect(secondResult.isValid).toBe(true)
    expect(findByAsaasCustomerIdAndAccountMock).toHaveBeenCalledWith("cus_primary", "primary")
    expect(updateSubscriptionAfterCheckoutMock).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "profile-1",
      subscriptionId: "sub_primary",
      account: "primary",
      cycle: "MONTHLY",
    }))
    expect(activateSubscriptionMock).toHaveBeenCalledWith("profile-1")
    expect(requestMock.mock.calls.filter(([endpoint, init]) => endpoint.endsWith("/subscriptions") && init?.method === "POST")).toHaveLength(1)
  })

  it("recusa pagamento detached com o legado R$ 59,90", async () => {
    requestMock.mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("/payments/")) {
        return { id: "payment_bad", customer: "cus_primary", value: 59.9, billingType: "CREDIT_CARD" }
      }
      return { data: [] }
    })
    findByAsaasCustomerIdAndAccountMock.mockResolvedValue({
      id: "profile-1",
      supabaseId: "sb-1",
      email: "fulano@example.test",
      fullName: "Fulano de Tal",
      timezone: "America/Sao_Paulo",
    })

    const result = await buildUseCase().processCheckoutPaid("payment_bad", "primary")

    expect(result.isValid).toBe(false)
    expect(updateSubscriptionAfterCheckoutMock).not.toHaveBeenCalled()
    expect(activateSubscriptionMock).not.toHaveBeenCalled()
  })
})
