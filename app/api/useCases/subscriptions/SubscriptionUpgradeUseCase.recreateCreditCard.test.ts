import { beforeEach, describe, expect, it, mock } from "bun:test"

// Achado P1 do Cursor no PR #1138 (20 — Assinaturas — Backend E3, DA2):
// recreateCreditCardSubscription/updateManagerSubscriptionValue (fluxo de
// "adicionar operador") operavam sempre no client Asaas default `primary`
// — um manager `asaasSubscriptionAccount === 'legacy'` tinha a assinatura
// atual consultada/cancelada na conta ERRADA, e a tolerância de 404
// (isSubscriptionAlreadyGoneError) classificava esse 404-de-conta-errada
// como "já inativa", mascarando o problema.
const findUniqueMock = mock(async () => null as Record<string, unknown> | null)
const profileUpdateMock = mock(async () => ({}))
const prismaMock = { profile: { findUnique: findUniqueMock, update: profileUpdateMock } }
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))

const getSubscriptionMock = mock(async () => ({ value: 59.9, billingType: "CREDIT_CARD" }) as any)
const updateSubscriptionMock = mock(async () => {
  const err = new Error("Não é possível alterar o valor de assinaturas via cartão de crédito")
  throw err
})
const createSubscriptionMock = mock(async (_data: unknown, accountId?: string) => ({
  success: true,
  subscriptionId: accountId === "legacy" ? "sub_legacy_new" : "sub_primary_new",
  data: { id: accountId === "legacy" ? "sub_legacy_new" : "sub_primary_new", nextDueDate: "2026-11-01", cycle: "MONTHLY" },
}))
const cancelSubscriptionMock = mock(async () => ({ deleted: true }))
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: {
    getSubscription: getSubscriptionMock,
    updateSubscription: updateSubscriptionMock,
    createSubscription: createSubscriptionMock,
    cancelSubscription: cancelSubscriptionMock,
  },
}))

mock.module("@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway", () => ({
  asaasCustomerGateway: { createCustomer: mock(async () => ({ id: "cus_primary_new" })) },
}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: mock((accountId: string) => ({
    endpoints: { customers: `https://asaas.test/${accountId}/customers`, subscriptions: `https://asaas.test/${accountId}/subscriptions`, payments: `https://asaas.test/${accountId}/payments` },
    request: mock(async () => ({})),
  })),
  asaasFetch: mock(async () => ({})),
  asaasApi: { customers: "https://asaas.test/primary/customers", subscriptions: "https://asaas.test/primary/subscriptions", payments: "https://asaas.test/primary/payments" },
}))
mock.module("@/lib/supabase/server", () => ({ createSupabaseAdmin: () => null }))
mock.module("@/lib/services/EmailService", () => ({ getEmailService: () => ({}) }))
mock.module("@/lib/supabase/email-auth-link", () => ({ buildSetPasswordEmailAuthLink: mock(async () => "") }))

const { SubscriptionUpgradeUseCase } = await import("./SubscriptionUpgradeUseCase")

function buildLegacyManager(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "manager-legacy-2",
    email: "manager2@example.test",
    fullName: "Manager Legacy Recreate",
    asaasCustomerId: "cus_legacy_2",
    asaasCustomerAccount: "legacy",
    asaasSubscriptionId: "sub_legacy_2",
    asaasSubscriptionAccount: "legacy",
    subscriptionNextDueDate: new Date("2026-10-01T00:00:00.000Z"),
    timezone: "America/Sao_Paulo",
    ...overrides,
  }
}

describe("SubscriptionUpgradeUseCase — recreateCreditCardSubscription/updateManagerSubscriptionValue roteados por conta (T-20.9x)", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    profileUpdateMock.mockClear()
    getSubscriptionMock.mockClear()
    updateSubscriptionMock.mockClear()
    createSubscriptionMock.mockClear()
    cancelSubscriptionMock.mockClear()
    getSubscriptionMock.mockImplementation(async () => ({ value: 59.9, billingType: "CREDIT_CARD" }))
    updateSubscriptionMock.mockImplementation(async () => {
      throw new Error("Não é possível alterar o valor de assinaturas via cartão de crédito")
    })
  })

  it("manager legacy: updateSubscription usa a conta legacy, não primary", async () => {
    const manager = buildLegacyManager()
    const useCase = new SubscriptionUpgradeUseCase() as any

    await useCase.updateManagerSubscriptionValue({
      manager,
      currentSubscription: { billingType: "CREDIT_CARD", id: "sub_legacy_2", cycle: "MONTHLY" },
      newValue: 79.8,
      operatorName: "Novo Operador",
    })

    expect(updateSubscriptionMock).toHaveBeenCalledWith("sub_legacy_2", { value: 79.8 }, "legacy")
  })

  it("manager legacy: erro transiente (não bloqueio de valor) cai no verify/retry, que consulta getSubscription na conta legacy", async () => {
    updateSubscriptionMock.mockImplementation(async () => {
      throw new Error("timeout na Asaas")
    })
    getSubscriptionMock.mockImplementation(async () => ({ value: 59.9 }))

    const manager = buildLegacyManager()
    const useCase = new SubscriptionUpgradeUseCase() as any

    let threw = false
    try {
      await useCase.updateManagerSubscriptionValue({
        manager,
        currentSubscription: { billingType: "CREDIT_CARD", id: "sub_legacy_2", cycle: "MONTHLY" },
        newValue: 79.8,
        operatorName: "Novo Operador",
      })
    } catch {
      threw = true
    }

    expect(threw).toBe(true)
    expect(getSubscriptionMock).toHaveBeenCalledWith("sub_legacy_2", "legacy")
  })

  it("recreateCreditCardSubscription: cria a nova na conta do CUSTOMER e cancela a antiga na conta da ASSINATURA", async () => {
    const manager = buildLegacyManager()
    const useCase = new SubscriptionUpgradeUseCase() as any

    await useCase.recreateCreditCardSubscription({
      manager,
      currentSubscription: { id: "sub_legacy_2", cycle: "MONTHLY", billingType: "CREDIT_CARD" },
      newValue: 79.8,
    })

    expect(createSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_legacy_2" }),
      "legacy",
    )
    expect(cancelSubscriptionMock).toHaveBeenCalledWith("sub_legacy_2", "legacy")
    expect(profileUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ asaasSubscriptionAccount: "legacy" }) }),
    )
  })

  // Controle negativo do achado P1 do Cursor: se customer e assinatura
  // estiverem em contas DIFERENTES (customer já migrado para primary,
  // assinatura antiga ainda na legacy — janela dual), a criação MUST ir
  // para a conta do customer e o cancelamento MUST ir para a conta da
  // assinatura antiga, nunca as duas para a mesma conta por default.
  it("customer já migrado (primary) + assinatura antiga ainda na legacy → cria na primary, cancela na legacy", async () => {
    const manager = buildLegacyManager({ asaasCustomerAccount: "primary", asaasCustomerId: "cus_already_primary" })
    const useCase = new SubscriptionUpgradeUseCase() as any

    await useCase.recreateCreditCardSubscription({
      manager,
      currentSubscription: { id: "sub_legacy_2", cycle: "MONTHLY", billingType: "CREDIT_CARD" },
      newValue: 79.8,
    })

    expect(createSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_already_primary" }),
      "primary",
    )
    expect(cancelSubscriptionMock).toHaveBeenCalledWith("sub_legacy_2", "legacy")
  })
})
