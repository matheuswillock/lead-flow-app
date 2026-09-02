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
//
// Achado Codex (PR #1137, P1, follow-up): a rota estava em
// prismaInV1RouteAllowlist — o refactor DIP moveu o acesso a dados para
// repositories + ConfirmTeamPaymentUseCase; este teste mocka essas camadas.

const masterId = "master-1"

const findBySupabaseIdMock = mock(async () => ({
  id: masterId,
  isMaster: true,
  managerId: null as string | null,
  activeTeamId: null as string | null,
}))
const findByIdMock = mock(async () => ({ asaasCustomerAccount: "primary" as const }))

mock.module("@/app/api/infra/data/repositories/profile/ProfileRepository", () => ({
  profileRepository: {
    findBySupabaseId: findBySupabaseIdMock,
    findById: findByIdMock,
  },
}))

const findMembershipMock = mock(async () => null)

mock.module("@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository", () => ({
  teamMembersRepository: {
    findMembership: findMembershipMock,
  },
}))

type PendingActionOwnershipLookup = {
  id: string
  masterId: string
  status: "pending" | "applied" | "failed" | "canceled"
  asaasAccount: "primary" | "legacy"
} | null

const findByPaymentIdAndMasterIdMock = mock(
  async (): Promise<PendingActionOwnershipLookup> => ({
    id: "pa-1",
    masterId,
    status: "pending",
    asaasAccount: "legacy",
  })
)
const findByIdSimpleMock = mock(async (): Promise<PendingActionOwnershipLookup> => null)

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: {
    findByPaymentIdAndMasterId: findByPaymentIdAndMasterIdMock,
    findByIdSimple: findByIdSimpleMock,
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
    findByPaymentIdAndMasterIdMock.mockClear()
    findByPaymentIdAndMasterIdMock.mockImplementation(async () => ({
      id: "pa-1",
      masterId,
      status: "pending" as const,
      asaasAccount: "legacy" as const,
    }))
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

  it("achado Codex (PR #1137, P1): ação não encontrada por masterId nem por externalReference → 404, sem tentar aplicar", async () => {
    findByPaymentIdAndMasterIdMock.mockImplementation(async () => null)
    requestImplByAccount.primary = async () => ({ status: "CONFIRMED", externalReference: null })

    const response = await POST(makeRequest({ paymentId: "pay_desconhecido" }))

    expect(response.status).toBe(404)
    expect(applyPendingActionByPaymentIdMock).not.toHaveBeenCalled()
  })

  it("achado Codex (PR #1137, P2, round 7): pagamento órfão (updatePaymentId falhou) na legacy — sonda as duas contas e recupera via externalReference", async () => {
    findByPaymentIdAndMasterIdMock.mockImplementation(async () => null)
    requestImplByAccount.primary = async () => {
      throw new Error("404 na primary")
    }
    requestImplByAccount.legacy = async () => ({
      status: "CONFIRMED",
      externalReference: "pending-action-pa-orphan-1",
    })
    findByIdSimpleMock.mockImplementation(async () => ({
      id: "pa-orphan-1",
      masterId,
      status: "pending" as const,
      asaasAccount: "legacy" as const,
    }))

    const response = await POST(makeRequest({ paymentId: "pay_orphan_1" }))

    expect(response.status).toBe(201)
    expect(applyPendingActionByPaymentIdMock).toHaveBeenCalledWith("pay_orphan_1", "legacy")
  })
})
