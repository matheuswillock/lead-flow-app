import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.8 de [[20 — Assinaturas — Backend]] E3 (C15 🔴, C27, DA2).
const findUniqueMock = mock(async () => null as Record<string, unknown> | null)
const profileUpdateMock = mock(async (_args?: { data?: Record<string, unknown> }) => ({}))
const prismaMock = {
  profile: { findUnique: findUniqueMock, update: profileUpdateMock },
}
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))

// Achados P1 da revisão do PR #1207 (chatgpt-codex-connector, threads
// PRRT_...CUk2 e PRRT_...YP_r): ProfileSubscription é ponteiro irmão que
// precisa acompanhar o Profile quando a migração de upgrade troca o sub_,
// e as duas escritas têm de ser atômicas — por isso saíram do UseCase para
// um repository transacional.
const migrateSubscriptionPointersMock = mock(async (_input: Record<string, unknown>) => {})
mock.module("@/app/api/infra/data/repositories/subscriptions/SubscriptionPointerRepository", () => ({
  subscriptionPointerRepository: { migrateSubscriptionPointers: migrateSubscriptionPointersMock },
}))

const createSubscriptionMock = mock(async (_data: unknown, accountId?: string) => ({
  success: true,
  subscriptionId: accountId === "legacy" ? "sub_legacy_new" : "sub_primary_new",
  data: { id: accountId === "legacy" ? "sub_legacy_new" : "sub_primary_new", nextDueDate: "2026-11-01", cycle: "MONTHLY" },
}))
const updateSubscriptionMock = mock(async () => ({}) as any)
const cancelSubscriptionMock = mock(async () => ({ deleted: true }))
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: {
    createSubscription: createSubscriptionMock,
    updateSubscription: updateSubscriptionMock,
    cancelSubscription: cancelSubscriptionMock,
    getSubscription: mock(async () => ({ value: 0 }) as any),
  },
}))

const createCustomerMock = mock(async () => ({ id: "cus_primary_new" }))
mock.module("@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway", () => ({
  asaasCustomerGateway: { createCustomer: createCustomerMock },
}))

const requestMock = mock(async () => ({}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: mock((accountId: string) => ({
    endpoints: {
      customers: `https://asaas.test/${accountId}/customers`,
      subscriptions: `https://asaas.test/${accountId}/subscriptions`,
      payments: `https://asaas.test/${accountId}/payments`,
    },
    request: requestMock,
  })),
  asaasFetch: mock(async () => ({})),
  asaasApi: {
    customers: "https://asaas.test/primary/customers",
    subscriptions: "https://asaas.test/primary/subscriptions",
    payments: "https://asaas.test/primary/payments",
  },
}))
mock.module("@/lib/supabase/server", () => ({ createSupabaseAdmin: () => null }))
mock.module("@/lib/services/EmailService", () => ({ getEmailService: () => ({}) }))
mock.module("@/lib/supabase/email-auth-link", () => ({ buildSetPasswordEmailAuthLink: mock(async () => "") }))

const { SubscriptionUpgradeUseCase } = await import("./SubscriptionUpgradeUseCase")

function buildLegacyManager(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "manager-legacy-1",
    email: "manager@example.test",
    fullName: "Manager Legacy",
    cpfCnpj: null,
    phone: null,
    postalCode: null,
    address: null,
    addressNumber: null,
    complement: null,
    asaasCustomerId: "cus_legacy_1",
    asaasCustomerAccount: "legacy",
    asaasSubscriptionId: "sub_legacy_1",
    asaasSubscriptionAccount: "legacy",
    subscriptionNextDueDate: new Date("2026-10-01T00:00:00.000Z"),
    timezone: "America/Sao_Paulo",
    operators: [{ id: "op-1" }],
    ...overrides,
  }
}

describe("SubscriptionUpgradeUseCase.updateManagerSubscription — migração no upgrade (T-20.8)", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    profileUpdateMock.mockClear()
    migrateSubscriptionPointersMock.mockClear()
    migrateSubscriptionPointersMock.mockImplementation(async () => {})
    createSubscriptionMock.mockClear()
    updateSubscriptionMock.mockClear()
    cancelSubscriptionMock.mockClear()
    createCustomerMock.mockClear()
  })

  it("assinatura legada: cria a nova na primary ANTES de inativar a antiga na legacy — nunca cancela primeiro", async () => {
    findUniqueMock.mockImplementationOnce(async () => buildLegacyManager())

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.updateManagerSubscription("manager-legacy-1")

    expect(result.isValid).toBe(true)
    // Nova assinatura criada na primary usando o customer já migrado.
    expect(createSubscriptionMock).toHaveBeenCalledTimes(1)
    expect(createSubscriptionMock).toHaveBeenCalledWith(expect.anything(), "primary")
    // Antiga inativada via PUT INACTIVE na legacy (DA4) — nunca DELETE.
    expect(updateSubscriptionMock).toHaveBeenCalledWith(
      "sub_legacy_1",
      { status: "INACTIVE" },
      "legacy",
    )
    expect(cancelSubscriptionMock).not.toHaveBeenCalled()
    // Nunca existe um momento em que a legada some sem a nova existir:
    // create (mock call order) precisa vir antes do update INACTIVE.
    const createOrder = createSubscriptionMock.mock.invocationCallOrder[0]
    const inactivateOrder = updateSubscriptionMock.mock.invocationCallOrder[0]
    expect(createOrder).toBeLessThan(inactivateOrder)
  })

  it("customer ainda não migrado (asaasCustomerAccount=legacy) → cria customer via gateway antes da assinatura", async () => {
    findUniqueMock.mockImplementationOnce(async () =>
      buildLegacyManager({ asaasCustomerAccount: "legacy" }),
    )

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.updateManagerSubscription("manager-legacy-1")

    expect(result.isValid).toBe(true)
    expect(createCustomerMock).toHaveBeenCalledTimes(1)
    expect(createCustomerMock).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "manager-legacy-1" }),
    )
    expect(createSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_primary_new" }),
      "primary",
    )
  })

  it("customer já migrado (asaasCustomerAccount=primary) → reaproveita o id, não recria customer", async () => {
    findUniqueMock.mockImplementationOnce(async () =>
      buildLegacyManager({ asaasCustomerAccount: "primary", asaasCustomerId: "cus_already_primary" }),
    )

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.updateManagerSubscription("manager-legacy-1")

    expect(result.isValid).toBe(true)
    expect(createCustomerMock).not.toHaveBeenCalled()
    expect(createSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_already_primary" }),
      "primary",
    )
  })

  it("achado P1 PRRT_...CUk2: mirror em ProfileSubscription (mesmo sub_ antigo) é atualizado junto do Profile", async () => {
    findUniqueMock.mockImplementationOnce(async () => buildLegacyManager())

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.updateManagerSubscription("manager-legacy-1")

    expect(result.isValid).toBe(true)
    // O backfill (20260918150645) só sabe relabelar a ProfileSubscription
    // quando ela ainda aponta para o MESMO sub_ que o Profile tinha antes
    // da migração — por isso o repository recebe o id ANTIGO
    // ("sub_legacy_1") como `previousSubscriptionId`.
    expect(migrateSubscriptionPointersMock).toHaveBeenCalledWith({
      profileId: "manager-legacy-1",
      previousSubscriptionId: "sub_legacy_1",
      newSubscriptionId: "sub_primary_new",
      account: "primary",
      subscriptionNextDueDate: new Date("2026-11-01"),
      operatorCount: 1,
    })
    // Achado P1 PRRT_...YP_r: o UseCase não escreve mais o PONTEIRO de
    // assinatura solto — quem garante atomicidade é o repository
    // transacional. (O `profile.update` que sobra é o do `asaasCustomerId`
    // recém-criado na primary, outra escrita e outro campo.)
    const pointerWrites = profileUpdateMock.mock.calls.filter(
      (call) => call[0]?.data !== undefined && "asaasSubscriptionId" in call[0].data
    )
    expect(pointerWrites).toHaveLength(0)
  })

  it("controle negativo: ProfileSubscription de um produto distinto (id diferente do Profile) não é tocada pela migração", async () => {
    // Cenário do comentário do schema (ProfileSubscription:4204): esta
    // coluna também serve o fluxo de adesão a produto, com um sub_
    // totalmente diferente da assinatura direta do Profile. A migração de
    // upgrade não pode sobrescrever esse ponteiro alheio — a proteção é o
    // `previousSubscriptionId`, que o repository usa como filtro: nunca
    // manda profileId sozinho, que atingiria qualquer ProfileSubscription
    // do profile.
    findUniqueMock.mockImplementationOnce(async () => buildLegacyManager())

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.updateManagerSubscription("manager-legacy-1")

    expect(result.isValid).toBe(true)
    expect(migrateSubscriptionPointersMock).toHaveBeenCalledWith(
      expect.objectContaining({ previousSubscriptionId: "sub_legacy_1" })
    )
  })

  it("achado P1 PRRT_...YP_r: falha na escrita atômica dos ponteiros não é engolida — o upgrade reporta erro", async () => {
    // Se a transação falhar, o UseCase não pode devolver sucesso: o
    // cliente ficaria achando que migrou enquanto os dois ponteiros
    // seguem no estado antigo.
    findUniqueMock.mockImplementationOnce(async () => buildLegacyManager())
    migrateSubscriptionPointersMock.mockImplementationOnce(async () => {
      throw new Error("db down")
    })

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.updateManagerSubscription("manager-legacy-1")

    expect(result.isValid).toBe(false)
  })

  it("assinatura já na primary → mantém fluxo cancela-depois-cria (compat), roteado pela conta primary", async () => {
    findUniqueMock.mockImplementationOnce(async () =>
      buildLegacyManager({
        asaasCustomerAccount: "primary",
        asaasCustomerId: "cus_primary_1",
        asaasSubscriptionAccount: "primary",
        asaasSubscriptionId: "sub_primary_1",
      }),
    )

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.updateManagerSubscription("manager-legacy-1")

    expect(result.isValid).toBe(true)
    expect(cancelSubscriptionMock).toHaveBeenCalledWith("sub_primary_1", "primary")
    expect(updateSubscriptionMock).not.toHaveBeenCalled()
  })
})
