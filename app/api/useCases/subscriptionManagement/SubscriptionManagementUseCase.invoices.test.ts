import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.6 de [[20 — Assinaturas — Backend]] E2 (C16/DA2).
//
// Escopo desta sessão: fan-out real nas DUAS contas (mutação #2 da SPEC)
// depende do ledger da migração ([[30 — Migração de Conta (execução) —
// Backend]]) para saber o customerId da conta antiga após o cutover — esse
// ledger não existe nesta base ainda (confirmado por busca antes de
// escrever este teste). O que este teste prova é o que já é possível e já
// resolve C16: a busca de faturas usa a conta correta do ponteiro
// (`asaasCustomerAccount`) em vez do client global fixo em primary.
const findUniqueMock = mock(async () => null as Record<string, unknown> | null)
const findUniqueSubscriptionMock = mock(async () => null as Record<string, unknown> | null)

const prismaMock = {
  profile: { findUnique: findUniqueMock },
  profileSubscription: { findUnique: findUniqueSubscriptionMock },
}
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))

mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: {},
}))

const requestMock = mock(async () => ({ data: [], totalCount: 0 }))
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

describe("SubscriptionManagementUseCase.getInvoices — roteamento por conta (T-20.6)", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    findUniqueSubscriptionMock.mockClear()
    createAsaasClientMock.mockClear()
    requestMock.mockClear()
    requestMock.mockImplementation(async () => ({ data: [], totalCount: 0 }))
  })

  it("perfil com asaasCustomerAccount=legacy → busca faturas via createAsaasClient('legacy')", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      id: "profile-legacy",
      supabaseId: "sb-legacy",
      fullName: "Cliente Legacy",
      email: "legacy@example.test",
      isMaster: true,
      managerId: null,
      asaasCustomerId: "cus_legacy_1",
      asaasCustomerAccount: "legacy",
      asaasSubscriptionId: "sub_legacy_1",
      asaasSubscriptionAccount: "legacy",
    }))
    findUniqueSubscriptionMock.mockImplementationOnce(async () => null)

    const useCase = new SubscriptionManagementUseCase()
    const result = await useCase.getInvoices("sb-legacy")

    expect(result.isValid).toBe(true)
    expect(createAsaasClientMock).toHaveBeenCalledWith("legacy")
    expect(createAsaasClientMock).not.toHaveBeenCalledWith("primary")
  })

  it("perfil só primary → busca faturas via createAsaasClient('primary')", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      id: "profile-primary",
      supabaseId: "sb-primary",
      fullName: "Cliente Primary",
      email: "primary@example.test",
      isMaster: true,
      managerId: null,
      asaasCustomerId: "cus_primary_1",
      asaasCustomerAccount: "primary",
      asaasSubscriptionId: "sub_primary_1",
      asaasSubscriptionAccount: "primary",
    }))
    findUniqueSubscriptionMock.mockImplementationOnce(async () => null)

    const useCase = new SubscriptionManagementUseCase()
    const result = await useCase.getInvoices("sb-primary")

    expect(result.isValid).toBe(true)
    expect(createAsaasClientMock).toHaveBeenCalledWith("primary")
    expect(createAsaasClientMock).not.toHaveBeenCalledWith("legacy")
  })
})
