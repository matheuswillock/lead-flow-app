import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse, after } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  after,
  connection: mock(async () => undefined),
}))
mock.module("server-only", () => ({}))

// Achado cursor[bot] (PR #1137, P1, follow-up de 27ac1321): a conta usada
// para consultar o Asaas e para aplicar a pending action não pode vir do
// estado ATUAL do master (mutável — E4, checkout de operador pode migrar de
// legacy para primary) — precisa vir da conta PERSISTIDA na própria
// PendingAction, no instante em que o paymentId nasceu (C33).

const masterId = "master-1"

const profileFindUniqueMock = mock(async ({ where }: any) => {
  if (where.supabaseId) {
    return { id: masterId, isMaster: true, managerId: null, activeTeamId: null }
  }
  if (where.id === masterId) {
    // conta ATUAL do master — já migrou para primary depois do pagamento nascer
    return { asaasCustomerAccount: "primary" as const }
  }
  return null
})
const teamMemberFindUniqueMock = mock(async () => null)
const pendingActionFindFirstMock = mock(async () => ({
  id: "pa-1",
  masterId,
  status: "pending" as const,
  asaasAccount: "legacy" as const,
}))
const pendingActionFindUniqueMock = mock(async () => null)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findUnique: profileFindUniqueMock },
    teamMember: { findUnique: teamMemberFindUniqueMock },
    pendingAction: { findFirst: pendingActionFindFirstMock, findUnique: pendingActionFindUniqueMock },
  },
}))

const requestLog: Array<{ account: string; method?: string }> = []
const requestImplByAccount: Record<string, () => Promise<any>> = {}

function endpointsFor(accountId: string) {
  return { payments: `https://sandbox.asaas.com/api/v3/payments?account=${accountId}` }
}

mock.module("@/lib/asaas", () => ({
  createAsaasClient: (accountId: "primary" | "legacy") => ({
    endpoints: endpointsFor(accountId),
    request: async (_url: string, init?: RequestInit) => {
      requestLog.push({ account: accountId, method: init?.method })
      const impl = requestImplByAccount[accountId]
      if (!impl) throw new Error(`sem mock de request configurado para a conta ${accountId}`)
      return impl()
    },
  }),
}))

const applyPendingActionByPaymentIdMock = mock(async () => new Output(true, ["ok"], [], null))

mock.module("@/app/api/useCases/pendingActions/PendingActionUseCase", () => ({
  pendingActionUseCase: { applyPendingActionByPaymentId: applyPendingActionByPaymentIdMock },
}))

const { POST } = await import("./route")

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/teams/confirm-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-supabase-user-id": "sb-master-1" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/v1/teams/confirm-payment — roteia pela conta da PendingAction (C33)", () => {
  beforeEach(() => {
    requestLog.length = 0
    applyPendingActionByPaymentIdMock.mockClear()
    pendingActionFindFirstMock.mockClear()
    requestImplByAccount.legacy = async () => ({ status: "CONFIRMED", externalReference: null })
    requestImplByAccount.primary = async () => {
      throw new Error("não deveria consultar a conta primary — a action nasceu na legacy")
    }
  })

  it("achado cursor[bot] (PR #1137, P1): master migrou para primary, mas a action nasceu na legacy — GET e aplicação roteiam pela legacy", async () => {
    const response = await POST(makeRequest({ paymentId: "pay_legacy_1" }))

    expect(response.status).toBe(201)
    expect(requestLog).toHaveLength(1)
    expect(requestLog[0].account).toBe("legacy")
    expect(applyPendingActionByPaymentIdMock).toHaveBeenCalledWith("pay_legacy_1", "legacy")
  })
})
