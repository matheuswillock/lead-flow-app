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
const requestMock = mock(async (_endpoint: string, _init?: RequestInit) => ({
  subscription: "sub_legacy_1",
}))
const createAsaasClientMock = mock((accountId: string) => ({
  endpoints: { payments: `https://asaas.test/${accountId}/payments` },
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
  let activateSubscriptionMock: ReturnType<typeof mock>

  beforeEach(() => {
    requestMock.mockClear()
    createAsaasClientMock.mockClear()
    asaasFetchMock.mockClear()
    findByAsaasSubscriptionIdAndAccountMock = mock(async () => ({
      id: "profile-1",
      supabaseId: "sb-1",
      email: "fulano@example.test",
      fullName: "Fulano de Tal",
    }))
    activateSubscriptionMock = mock(async () => {})
  })

  function buildUseCase() {
    const profileRepository = {
      findByAsaasSubscriptionIdAndAccount: findByAsaasSubscriptionIdAndAccountMock,
      activateSubscription: activateSubscriptionMock,
    } as any
    return new CheckoutAsaasUseCase(profileRepository, {} as any, {} as any, {} as any, {} as any)
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
})
