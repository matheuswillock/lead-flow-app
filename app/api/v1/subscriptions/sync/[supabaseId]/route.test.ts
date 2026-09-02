import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.12 de [[20 — Assinaturas — Backend]] E4 (C18/C29/DA3).
const findUniqueMock = mock(async () => null as Record<string, unknown> | null)
const profileUpdateMock = mock(async () => ({}))
const prismaMock = { profile: { findUnique: findUniqueMock, update: profileUpdateMock } }
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))

const listSubscriptionsMock = mock(async () => [] as Array<{ id: string; status?: string; value: number; cycle: string }>)
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: { listSubscriptions: listSubscriptionsMock },
}))

const { POST } = await import("./route")

function buildRequest() {
  return {} as any
}

describe("POST /api/v1/subscriptions/sync/[supabaseId] — sem falso cancelamento (T-20.12)", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    profileUpdateMock.mockClear()
    listSubscriptionsMock.mockClear()
  })

  it("lista vazia (sem assinaturas) → NENHUM write de canceled", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      supabaseId: "sb-1",
      asaasCustomerId: "cus_1",
      asaasCustomerAccount: "primary",
    }))
    listSubscriptionsMock.mockImplementationOnce(async () => [])

    const response = await POST(buildRequest(), { params: Promise.resolve({ supabaseId: "sb-1" }) })
    const body = await response.json()

    expect(body.isValid).toBe(true)
    expect(profileUpdateMock).not.toHaveBeenCalled()
  })

  it("erro na consulta Asaas → NENHUM write de canceled, resposta de erro explícita", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      supabaseId: "sb-2",
      asaasCustomerId: "cus_2",
      asaasCustomerAccount: "legacy",
    }))
    listSubscriptionsMock.mockImplementationOnce(async () => {
      throw new Error("timeout")
    })

    const response = await POST(buildRequest(), { params: Promise.resolve({ supabaseId: "sb-2" }) })
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.isValid).toBe(false)
    expect(profileUpdateMock).not.toHaveBeenCalled()
    expect(listSubscriptionsMock).toHaveBeenCalledWith("cus_2", { limit: 5 }, "legacy")
  })

  it("assinatura encontrada com status terminal (EXPIRED) → evidência positiva, grava canceled", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      supabaseId: "sb-3",
      asaasCustomerId: "cus_3",
      asaasCustomerAccount: "primary",
    }))
    listSubscriptionsMock.mockImplementationOnce(async () => [
      { id: "sub_3", status: "EXPIRED", value: 59.9, cycle: "MONTHLY" },
    ])

    const response = await POST(buildRequest(), { params: Promise.resolve({ supabaseId: "sb-3" }) })
    const body = await response.json()

    expect(body.isValid).toBe(true)
    expect(profileUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "canceled" }) }),
    )
  })

  it("assinatura encontrada sem status conclusivo (PENDING) → sem alteração", async () => {
    findUniqueMock.mockImplementationOnce(async () => ({
      supabaseId: "sb-4",
      asaasCustomerId: "cus_4",
      asaasCustomerAccount: "primary",
    }))
    listSubscriptionsMock.mockImplementationOnce(async () => [
      { id: "sub_4", status: "PENDING", value: 59.9, cycle: "MONTHLY" },
    ])

    const response = await POST(buildRequest(), { params: Promise.resolve({ supabaseId: "sb-4" }) })
    const body = await response.json()

    expect(body.isValid).toBe(true)
    expect(profileUpdateMock).not.toHaveBeenCalled()
  })
})
