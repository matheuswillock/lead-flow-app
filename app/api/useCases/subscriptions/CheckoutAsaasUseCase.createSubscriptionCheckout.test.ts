import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

mock.module("@/lib/supabase/server", () => ({
  createSupabaseAdmin: () => null,
}))

mock.module("@/lib/services/EmailService", () => ({
  EmailService: class {},
  createEmailService: () => ({}),
  getEmailService: () => ({}),
  emailService: {},
}))

// getFullUrl() lê NEXT_PUBLIC_APP_URL direto de process.env e LANÇA se
// ausente — não pode depender de env ambiente do runner (só existia na
// máquina do agente; CI não tem, achado real: pegou este teste em
// produção). Ver "Teste que não sabe falhar não é verificação" no
// agents.md.
mock.module("@/lib/utils/app-url", () => ({
  getFullUrl: (path: string) => `https://example.test${path}`,
}))

const asaasFetchMock = mock(async (_url: string, _init?: RequestInit) => ({ id: "checkout_1" }))
mock.module("@/lib/asaas", () => ({
  asaasFetch: asaasFetchMock,
  asaasApi: { customers: "x", checkouts: "x", payments: "x", subscriptions: "x" },
}))

const { CheckoutAsaasUseCase } = await import("./CheckoutAsaasUseCase")

const baseProfile = {
  id: "profile-1",
  supabaseId: "sb-1",
  fullName: "Fulano de Tal",
  email: "fulano@example.test",
  phone: "11999999999",
  cpfCnpj: null,
  postalCode: null,
  address: null,
  addressNumber: null,
  neighborhood: null,
  complement: null,
  asaasCustomerId: null,
  subscriptionId: null,
  timezone: "America/Sao_Paulo",
}

describe("CheckoutAsaasUseCase.createSubscriptionCheckout — criação de customer via gateway (E5/DA5)", () => {
  let findBySupabaseIdMock: ReturnType<typeof mock>
  let updateAsaasCustomerIdMock: ReturnType<typeof mock>
  let markProfileCheckoutTrialStartedMock: ReturnType<typeof mock>
  let deleteProfileMock: ReturnType<typeof mock>
  let clearAsaasCustomerIdMock: ReturnType<typeof mock>
  let createCustomerMock: ReturnType<typeof mock>

  beforeEach(() => {
    findBySupabaseIdMock = mock(async () => ({ ...baseProfile }))
    updateAsaasCustomerIdMock = mock(async () => {})
    markProfileCheckoutTrialStartedMock = mock(async () => {})
    // Caminhos de rollback (isFirstCheckoutAttempt) — mockados mesmo não
    // sendo o foco destes testes: um "as any" incompleto deixa qualquer
    // erro inesperado no caminho feliz virar TypeError no rollback em vez
    // do erro original, mascarando a causa real (foi exatamente o que
    // aconteceu quando getFullUrl não estava mockado).
    deleteProfileMock = mock(async () => ({ ...baseProfile }))
    clearAsaasCustomerIdMock = mock(async () => {})
    createCustomerMock = mock(async () => ({ id: "cus_new_gateway" }))
    asaasFetchMock.mockClear()
    asaasFetchMock.mockImplementation(async () => ({ id: "checkout_1" }))
  })

  function buildUseCase() {
    const profileRepository = {
      findBySupabaseId: findBySupabaseIdMock,
      updateAsaasCustomerId: updateAsaasCustomerIdMock,
      markProfileCheckoutTrialStarted: markProfileCheckoutTrialStartedMock,
      deleteProfile: deleteProfileMock,
      clearAsaasCustomerId: clearAsaasCustomerIdMock,
    } as any
    const gateway = { createCustomer: createCustomerMock } as any
    return new CheckoutAsaasUseCase(
      profileRepository,
      {} as any,
      {} as any,
      {} as any,
      gateway
    )
  }

  it("profile sem asaasCustomerId → cria via gateway com profileId, salva o id, nunca chama POST /customers direto", async () => {
    const useCase = buildUseCase()

    const result = await useCase.createSubscriptionCheckout({
      supabaseId: "sb-1",
      fullName: "Fulano de Tal",
      email: "fulano@example.test",
      phone: "11999999999",
    })

    expect(result.isValid).toBe(true)
    expect(createCustomerMock).toHaveBeenCalledTimes(1)
    expect(createCustomerMock).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "profile-1", name: "Fulano de Tal" })
    )
    expect(updateAsaasCustomerIdMock).toHaveBeenCalledWith("profile-1", "cus_new_gateway")
    expect(markProfileCheckoutTrialStartedMock).toHaveBeenCalledWith("profile-1")

    // A única chamada HTTP feita diretamente pelo UseCase é a de checkout —
    // a criação de customer passou inteiramente pelo gateway injetado
    // (createCustomerMock, já asserido acima), nunca por asaasFetch aqui.
    expect(asaasFetchMock).toHaveBeenCalledTimes(1)
  })

  it("profile já tem asaasCustomerId → não chama o gateway de novo", async () => {
    findBySupabaseIdMock = mock(async () => ({ ...baseProfile, asaasCustomerId: "cus_existing" }))
    const useCase = buildUseCase()
    ;(useCase as any).profileRepository.findBySupabaseId = findBySupabaseIdMock

    await useCase.createSubscriptionCheckout({
      supabaseId: "sb-1",
      fullName: "Fulano de Tal",
      email: "fulano@example.test",
      phone: "11999999999",
    })

    expect(createCustomerMock).not.toHaveBeenCalled()
  })
})
