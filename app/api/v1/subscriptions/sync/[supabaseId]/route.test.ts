import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.12 de [[20 — Assinaturas — Backend]] E4 (C18/C29/DA3).
const findUniqueMock = mock(async () => null as Record<string, unknown> | null)
const profileUpdateMock = mock(async () => ({}))
const prismaMock = { profile: { findUnique: findUniqueMock, update: profileUpdateMock } }
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))

const listSubscriptionsMock = mock(async () => [] as Array<{ id: string; status?: string; value: number; cycle: string }>)
type StubbedSubscription = { id: string; status: string; value: number; cycle: string; nextDueDate?: string; dateCreated?: string }
const getSubscriptionMock = mock(async (): Promise<StubbedSubscription> => {
  throw new Error("not stubbed")
})
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: { listSubscriptions: listSubscriptionsMock, getSubscription: getSubscriptionMock },
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
    getSubscriptionMock.mockClear()
    getSubscriptionMock.mockImplementation(async () => {
      throw new Error("not stubbed")
    })
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
    expect(listSubscriptionsMock).toHaveBeenCalledWith("cus_2", { limit: 20 }, "legacy")
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

  describe("ponteiro conhecido (asaasSubscriptionId) — lookup direto (achado P1 Codex)", () => {
    it("ponteiro conhecido ACTIVE → consulta getSubscription diretamente, NÃO chama listSubscriptions", async () => {
      findUniqueMock.mockImplementationOnce(async () => ({
        supabaseId: "sb-5",
        asaasCustomerId: "cus_5",
        asaasCustomerAccount: "primary",
        asaasSubscriptionId: "sub_known_5",
      }))
      getSubscriptionMock.mockImplementationOnce(async () => ({
        id: "sub_known_5",
        status: "ACTIVE",
        value: 59.9,
        cycle: "MONTHLY",
        nextDueDate: "2026-10-01",
        dateCreated: "2026-01-01",
      }))

      const response = await POST(buildRequest(), { params: Promise.resolve({ supabaseId: "sb-5" }) })
      const body = await response.json()

      expect(body.isValid).toBe(true)
      expect(getSubscriptionMock).toHaveBeenCalledWith("sub_known_5", "primary")
      expect(listSubscriptionsMock).not.toHaveBeenCalled()
      expect(profileUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "active" }) }),
      )
    })

    it("ponteiro conhecido EXPIRED → cancela via lookup direto, NÃO chama listSubscriptions", async () => {
      findUniqueMock.mockImplementationOnce(async () => ({
        supabaseId: "sb-6",
        asaasCustomerId: "cus_6",
        asaasCustomerAccount: "legacy",
        asaasSubscriptionId: "sub_known_6",
      }))
      getSubscriptionMock.mockImplementationOnce(async () => ({
        id: "sub_known_6",
        status: "EXPIRED",
        value: 59.9,
        cycle: "MONTHLY",
        nextDueDate: "2026-10-01",
        dateCreated: "2026-01-01",
      }))

      const response = await POST(buildRequest(), { params: Promise.resolve({ supabaseId: "sb-6" }) })
      const body = await response.json()

      expect(body.isValid).toBe(true)
      expect(getSubscriptionMock).toHaveBeenCalledWith("sub_known_6", "legacy")
      expect(listSubscriptionsMock).not.toHaveBeenCalled()
      expect(profileUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "canceled" }) }),
      )
    })

    it("lookup direto falha (erro ambíguo) → cai para listSubscriptions", async () => {
      findUniqueMock.mockImplementationOnce(async () => ({
        supabaseId: "sb-7",
        asaasCustomerId: "cus_7",
        asaasCustomerAccount: "primary",
        asaasSubscriptionId: "sub_known_7",
      }))
      getSubscriptionMock.mockImplementationOnce(async () => {
        throw new Error("network timeout")
      })
      listSubscriptionsMock.mockImplementationOnce(async () => [
        { id: "sub_known_7", status: "ACTIVE", value: 59.9, cycle: "MONTHLY" },
      ])

      const response = await POST(buildRequest(), { params: Promise.resolve({ supabaseId: "sb-7" }) })
      const body = await response.json()

      expect(body.isValid).toBe(true)
      expect(listSubscriptionsMock).toHaveBeenCalledWith("cus_7", { limit: 20 }, "primary")
      expect(profileUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "active" }) }),
      )
    })

    // Controle negativo do achado P1 do Codex: um EXPIRED de uma assinatura
    // ANTIGA (diferente do ponteiro atual do profile) aparecendo na página
    // da lista NÃO PODE rebaixar quem ainda paga — só a assinatura ATUAL
    // (asaasSubscriptionId) é evidência válida. Antes desta correção, esta
    // asserção falhava (profileUpdateMock ERA chamado com "canceled").
    it("lista tem EXPIRED de assinatura ANTIGA diferente do ponteiro atual → NÃO cancela (sem falso downgrade)", async () => {
      findUniqueMock.mockImplementationOnce(async () => ({
        supabaseId: "sb-8",
        asaasCustomerId: "cus_8",
        asaasCustomerAccount: "primary",
        asaasSubscriptionId: "sub_current_8",
      }))
      getSubscriptionMock.mockImplementationOnce(async () => {
        throw new Error("network timeout")
      })
      listSubscriptionsMock.mockImplementationOnce(async () => [
        { id: "sub_old_8", status: "EXPIRED", value: 59.9, cycle: "MONTHLY" },
      ])

      const response = await POST(buildRequest(), { params: Promise.resolve({ supabaseId: "sb-8" }) })
      const body = await response.json()

      expect(body.isValid).toBe(true)
      expect(profileUpdateMock).not.toHaveBeenCalled()
    })
  })
})
