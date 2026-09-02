import { beforeEach, describe, expect, it, mock } from "bun:test"

// Achado P1 do Codex/Cursor no PR #1138 (20 — Assinaturas — Backend E3,
// DA2): createOperatorPayment validava/recriava o customer pela conta
// resolvida do manager, mas createAsaasCheckoutLink criava o payment do
// checkout sempre via client global (primary) — um manager
// `asaasCustomerAccount === 'legacy'` não conseguia gerar checkout de
// operador porque o `cus_` legado não existe na primary.
const pendingOperatorCreateMock = mock(async () => ({ id: "pending-op-1" }))
const pendingOperatorUpdateMock = mock(async () => ({}))
const pendingOperatorDeleteMock = mock(async () => ({}))
const profileFindUniqueMock = mock(async () => null as Record<string, unknown> | null)
const profileFindFirstMock = mock(async () => null as Record<string, unknown> | null)
const profileUpdateMock = mock(async () => ({}))
const prismaMock = {
  profile: { findUnique: profileFindUniqueMock, findFirst: profileFindFirstMock, update: profileUpdateMock },
  pendingOperator: {
    create: pendingOperatorCreateMock,
    update: pendingOperatorUpdateMock,
    delete: pendingOperatorDeleteMock,
  },
}
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))

const requestMock = mock(async (endpoint: string) => {
  if (endpoint.includes("/customers/")) return { id: "cus_ok" }
  return { id: "pay_ok", status: "PENDING", invoiceUrl: "https://asaas.test/checkout/pay_ok" }
})
const createAsaasClientMock = mock((accountId: string) => ({
  endpoints: {
    customers: `https://asaas.test/${accountId}/customers`,
    subscriptions: `https://asaas.test/${accountId}/subscriptions`,
    payments: `https://asaas.test/${accountId}/payments`,
  },
  request: (endpoint: string) => requestMock(endpoint),
}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: createAsaasClientMock,
  asaasFetch: mock(async () => ({})),
  asaasApi: { customers: "https://asaas.test/primary/customers", subscriptions: "https://asaas.test/primary/subscriptions", payments: "https://asaas.test/primary/payments" },
}))

mock.module("@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway", () => ({
  asaasCustomerGateway: { createCustomer: mock(async () => ({ id: "cus_recreated_primary" })) },
}))
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: { getSubscription: mock(async () => ({ value: 0 })), createSubscription: mock(async () => ({})), updateSubscription: mock(async () => ({})), cancelSubscription: mock(async () => ({})) },
}))
mock.module("@/lib/supabase/server", () => ({ createSupabaseAdmin: () => null }))
mock.module("@/lib/services/EmailService", () => ({ getEmailService: () => ({}) }))
mock.module("@/lib/supabase/email-auth-link", () => ({ buildSetPasswordEmailAuthLink: mock(async () => "") }))

const { SubscriptionUpgradeUseCase } = await import("./SubscriptionUpgradeUseCase")

function buildManager(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "manager-op-1",
    supabaseId: "sb-manager-op-1",
    role: "manager",
    subscriptionStatus: "active",
    asaasCustomerId: "cus_existing",
    asaasCustomerAccount: "primary",
    email: "manager-op@example.test",
    fullName: "Manager Op",
    timezone: "America/Sao_Paulo",
    ...overrides,
  }
}

describe("SubscriptionUpgradeUseCase.createOperatorPayment — checkout roteado por conta (achado P1)", () => {
  beforeEach(() => {
    profileFindUniqueMock.mockClear()
    profileFindFirstMock.mockClear()
    profileUpdateMock.mockClear()
    pendingOperatorCreateMock.mockClear()
    pendingOperatorUpdateMock.mockClear()
    pendingOperatorDeleteMock.mockClear()
    createAsaasClientMock.mockClear()
    requestMock.mockClear()
    requestMock.mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("/customers/")) return { id: "cus_ok" }
      return { id: "pay_ok", status: "PENDING", invoiceUrl: "https://asaas.test/checkout/pay_ok" }
    })
  })

  it("manager legacy: valida customer E cria o payment do checkout na conta legacy (não primary)", async () => {
    profileFindUniqueMock.mockImplementationOnce(async () => buildManager({ asaasCustomerAccount: "legacy", asaasCustomerId: "cus_legacy_ok" }))

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.createOperatorPayment({
      managerId: "sb-manager-op-1",
      operatorData: { name: "Novo Op", email: "novo-op@example.test", role: "operator", functions: [] },
      paymentMethod: "PIX",
    } as any)

    expect(result.isValid).toBe(true)
    // client criado para verificar o customer E para criar o payment — ambos na legacy.
    const accountsUsed = createAsaasClientMock.mock.calls.map((call) => call[0])
    expect(accountsUsed).toContain("legacy")
    expect(accountsUsed).not.toContain("primary")
  })

  it("customer recriado (não existia na conta atual) → checkout usa a conta primary junto com o novo customer", async () => {
    profileFindUniqueMock.mockImplementationOnce(async () => buildManager({ asaasCustomerAccount: "legacy", asaasCustomerId: "cus_missing" }))
    requestMock.mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("/customers/")) throw new Error("Customer não encontrado")
      return { id: "pay_ok", status: "PENDING", invoiceUrl: "https://asaas.test/checkout/pay_ok" }
    })

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.createOperatorPayment({
      managerId: "sb-manager-op-1",
      operatorData: { name: "Novo Op", email: "novo-op2@example.test", role: "operator", functions: [] },
      paymentMethod: "PIX",
    } as any)

    expect(result.isValid).toBe(true)
    const accountsUsed = createAsaasClientMock.mock.calls.map((call) => call[0])
    // checkout deve ir para a conta do customer RECRIADO (primary), não a
    // conta original (legacy) do manager.
    expect(accountsUsed[accountsUsed.length - 1]).toBe("primary")
  })
})
