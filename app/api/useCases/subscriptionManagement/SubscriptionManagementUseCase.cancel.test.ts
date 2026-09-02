import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.5 de [[20 — Assinaturas — Backend]] E2 (C16/DA2/DA4).
const findUniqueMock = mock(async () => null as Record<string, unknown> | null)
const profileUpdateMock = mock(async () => ({}))
const profileSubscriptionUpdateManyMock = mock(async () => ({ count: 0 }))

const prismaMock = {
  profile: {
    findUnique: findUniqueMock,
    update: profileUpdateMock,
  },
  profileSubscription: {
    updateMany: profileSubscriptionUpdateManyMock,
  },
}
mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}))

const cancelSubscriptionMock = mock(async () => ({ deleted: true }))
const updateSubscriptionMock = mock(async () => ({}) as any)
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: {
    cancelSubscription: cancelSubscriptionMock,
    updateSubscription: updateSubscriptionMock,
  },
}))

const requestMock = mock(async () => ({}))
mock.module("@/lib/asaas", () => ({
  createAsaasClient: mock((accountId: string) => ({
    endpoints: { payments: `https://asaas.test/${accountId}/payments`, subscriptions: `https://asaas.test/${accountId}/subscriptions` },
    request: requestMock,
  })),
  asaasFetch: mock(async () => ({})),
  asaasApi: { payments: "https://asaas.test/primary/payments", subscriptions: "https://asaas.test/primary/subscriptions" },
}))

const { SubscriptionManagementUseCase } = await import("./SubscriptionManagementUseCase")

describe("SubscriptionManagementUseCase.cancelSubscription — roteamento por conta (T-20.5)", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    profileUpdateMock.mockClear()
    profileSubscriptionUpdateManyMock.mockClear()
    cancelSubscriptionMock.mockClear()
    updateSubscriptionMock.mockClear()
  })

  it("asaasSubscriptionAccount=primary → cancela via DELETE na conta primary", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      id: "profile-1",
      subscriptionId: null,
      asaasSubscriptionId: "sub_primary_1",
      asaasSubscriptionAccount: "primary",
      subscription: null,
    }))

    const useCase = new SubscriptionManagementUseCase()
    const result = await useCase.cancelSubscription("supabase-1", "motivo")

    expect(result.isValid).toBe(true)
    expect(cancelSubscriptionMock).toHaveBeenCalledWith("sub_primary_1", "primary")
    expect(updateSubscriptionMock).not.toHaveBeenCalled()
  })

  it("asaasSubscriptionAccount=legacy → PUT status INACTIVE na conta legacy, nunca DELETE (DA4)", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      id: "profile-2",
      subscriptionId: null,
      asaasSubscriptionId: "sub_legacy_1",
      asaasSubscriptionAccount: "legacy",
      subscription: null,
    }))

    const useCase = new SubscriptionManagementUseCase()
    const result = await useCase.cancelSubscription("supabase-2", "motivo")

    expect(result.isValid).toBe(true)
    expect(cancelSubscriptionMock).not.toHaveBeenCalled()
    expect(updateSubscriptionMock).toHaveBeenCalledWith(
      "sub_legacy_1",
      { status: "INACTIVE" },
      "legacy",
    )
  })
})
