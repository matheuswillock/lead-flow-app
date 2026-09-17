import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.7 de [[20 — Assinaturas — Backend]] E2 (C16/DA2).
const findUniqueMock = mock(async () => null as Record<string, unknown> | null)
const prismaMock = { profile: { findUnique: findUniqueMock } }
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))

mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: {},
}))

const requestMock = mock(async (endpoint: string) => {
  if (endpoint.includes("payWithCreditCard")) return { status: "CONFIRMED" }
  return { id: "pay_1", customer: "cus_legacy_1", subscription: "sub_legacy_1" }
})
const createAsaasClientMock = mock((accountId: string) => ({
  endpoints: {
    payments: `https://asaas.test/${accountId}/payments`,
    subscriptions: `https://asaas.test/${accountId}/subscriptions`,
  },
  request: requestMock,
}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: createAsaasClientMock,
  asaasFetch: mock(async () => ({})),
  asaasApi: { payments: "https://asaas.test/primary/payments", subscriptions: "https://asaas.test/primary/subscriptions" },
}))

const { SubscriptionManagementUseCase } = await import("./SubscriptionManagementUseCase")

describe("SubscriptionManagementUseCase.retryPayment — roteamento por conta (T-20.7)", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    createAsaasClientMock.mockClear()
    requestMock.mockClear()
  })

  it("pay_ de assinatura legada → GET e retry usam createAsaasClient('legacy')", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      id: "profile-legacy",
      asaasCustomerId: "cus_legacy_1",
      asaasCustomerAccount: "legacy",
      subscriptionId: null,
      asaasSubscriptionId: "sub_legacy_1",
      asaasSubscriptionAccount: "legacy",
      subscription: null,
    }))

    const useCase = new SubscriptionManagementUseCase()
    const result = await useCase.retryPayment("sb-legacy", "pay_1")

    expect(result.isValid).toBe(true)
    expect(createAsaasClientMock).toHaveBeenCalledWith("legacy")
    expect(createAsaasClientMock).not.toHaveBeenCalledWith("primary")
  })

  it("falha em conta errada não vira 'Fatura não encontrada' genérico quando a fatura pertence ao usuário mas o lookup falha por outro motivo", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      id: "profile-primary",
      asaasCustomerId: "cus_primary_1",
      asaasCustomerAccount: "primary",
      subscriptionId: null,
      asaasSubscriptionId: "sub_primary_1",
      asaasSubscriptionAccount: "primary",
      subscription: null,
    }))
    requestMock.mockImplementationOnce(async () => {
      throw new Error("timeout")
    })

    const useCase = new SubscriptionManagementUseCase()
    const result = await useCase.retryPayment("sb-primary", "pay_x")

    expect(result.isValid).toBe(false)
    expect(createAsaasClientMock).toHaveBeenCalledWith("primary")
  })
})
