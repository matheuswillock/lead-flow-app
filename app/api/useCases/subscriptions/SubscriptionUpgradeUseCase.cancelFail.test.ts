import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.9 de [[20 — Assinaturas — Backend]] E3 (C15 🔴/DA5).
const findUniqueMock = mock(async () => null as Record<string, unknown> | null)
const prismaMock = { profile: { findUnique: findUniqueMock, update: mock(async () => ({})) } }
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))

const createSubscriptionMock = mock(async () => ({
  success: true,
  subscriptionId: "sub_new",
  data: { id: "sub_new", nextDueDate: "2026-11-01", cycle: "MONTHLY" },
}))
const cancelSubscriptionMock = mock(async () => {
  throw Object.assign(new Error("timeout na Asaas"), { statusCode: 500 })
})
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: {
    createSubscription: createSubscriptionMock,
    updateSubscription: mock(async () => ({}) as any),
    cancelSubscription: cancelSubscriptionMock,
    getSubscription: mock(async () => ({ value: 0 }) as any),
  },
}))

mock.module("@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway", () => ({
  asaasCustomerGateway: { createCustomer: mock(async () => ({ id: "cus_x" })) },
}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: mock((accountId: string) => ({
    endpoints: {
      customers: `https://asaas.test/${accountId}/customers`,
      subscriptions: `https://asaas.test/${accountId}/subscriptions`,
      payments: `https://asaas.test/${accountId}/payments`,
    },
    request: mock(async () => ({})),
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

describe("SubscriptionUpgradeUseCase.updateManagerSubscription — cancel falha aborta (T-20.9)", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    createSubscriptionMock.mockClear()
    cancelSubscriptionMock.mockClear()
  })

  it("cancel falha com erro real (≠404) → NENHUMA assinatura nova é criada, Output inválido", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      id: "manager-1",
      email: "manager@example.test",
      fullName: "Manager",
      asaasCustomerId: "cus_primary_1",
      asaasCustomerAccount: "primary",
      asaasSubscriptionId: "sub_primary_1",
      asaasSubscriptionAccount: "primary",
      subscriptionNextDueDate: new Date("2026-10-01T00:00:00.000Z"),
      timezone: "America/Sao_Paulo",
      operators: [],
    }))

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.updateManagerSubscription("manager-1")

    expect(result.isValid).toBe(false)
    expect(createSubscriptionMock).not.toHaveBeenCalled()
  })

  it("cancel falha com 404 (já inativa) → tolerado, segue e cria a nova", async () => {
    cancelSubscriptionMock.mockImplementationOnce(async () => {
      throw Object.assign(new Error("Subscription not found"), { statusCode: 404 })
    })
    findUniqueMock.mockImplementationOnce(async () => ({
      id: "manager-2",
      email: "manager2@example.test",
      fullName: "Manager 2",
      asaasCustomerId: "cus_primary_2",
      asaasCustomerAccount: "primary",
      asaasSubscriptionId: "sub_primary_2",
      asaasSubscriptionAccount: "primary",
      subscriptionNextDueDate: new Date("2026-10-01T00:00:00.000Z"),
      timezone: "America/Sao_Paulo",
      operators: [],
    }))

    const useCase = new SubscriptionUpgradeUseCase()
    const result = await useCase.updateManagerSubscription("manager-2")

    expect(result.isValid).toBe(true)
    expect(createSubscriptionMock).toHaveBeenCalledTimes(1)
  })
})
