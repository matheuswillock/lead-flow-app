import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.8 de [[20 — Assinaturas — Backend]] E3 (C15 🔴, C27, DA2).
const findUniqueMock = mock(async () => null as Record<string, unknown> | null)
const profileUpdateMock = mock(async () => ({}))
const prismaMock = {
  profile: { findUnique: findUniqueMock, update: profileUpdateMock },
}
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))

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
