import { beforeEach, describe, expect, it, mock } from "bun:test"

// Fase B: uma cobrança AbacatePay (paymentId "provider-…") não existe no Asaas.
// A confirmação de time não pode consultar o Asaas com esse id: a rota devolvia 500.

const asaasRequestMock = mock(async (_endpoint: string, _options?: unknown): Promise<unknown> => {
  throw new Error("Asaas não deveria ser chamado para cobrança AbacatePay")
})
const createAsaasClientMock = mock((_account: unknown) => ({
  endpoints: { payments: "/payments" },
  request: asaasRequestMock,
}))
const applyPendingActionByPaymentIdMock = mock(async (_paymentId: string, _account: unknown) => ({ isValid: true }))

mock.module("@/lib/asaas", () => ({ createAsaasClient: createAsaasClientMock }))
mock.module("@/app/api/useCases/pendingActions/PendingActionUseCase", () => ({
  pendingActionUseCase: { applyPendingActionByPaymentId: applyPendingActionByPaymentIdMock },
}))
mock.module("@/app/api/infra/data/repositories/profile/ProfileRepository", () => ({ profileRepository: {} }))
mock.module("@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository", () => ({ teamMembersRepository: {} }))
mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: {},
}))

const { ConfirmTeamPaymentUseCase } = await import("./ConfirmTeamPaymentUseCase")

const masterProfile = { id: "profile-master-1", isMaster: true, activeTeamId: null, managerId: null }

const profileRepo = { findBySupabaseId: mock(async (_supabaseId: string) => masterProfile) }
const teamMembersRepo = { findMembership: mock(async () => null) }
const pendingActionRepo = {
  findByPaymentIdAndMasterId: mock(async (_paymentId: string, _masterId: string) => abacateLookup as any),
  findByIdSimple: mock(async (_id: string) => null),
  updatePaymentId: mock(async () => {}),
}

const abacateLookup = {
  id: "pa-1",
  masterId: "profile-master-1",
  status: "pending",
  asaasAccount: "primary",
  provider: "ABACATE_PAY",
}
const asaasLookup = { ...abacateLookup, provider: null }

const build = () =>
  new ConfirmTeamPaymentUseCase(profileRepo as any, teamMembersRepo as any, pendingActionRepo as any)

describe("ConfirmTeamPaymentUseCase — cobrança AbacatePay não vai ao Asaas", () => {
  beforeEach(() => {
    pendingActionRepo.findByPaymentIdAndMasterId.mockImplementation(async () => abacateLookup as any)
    asaasRequestMock.mockClear()
    createAsaasClientMock.mockClear()
    applyPendingActionByPaymentIdMock.mockClear()
  })

  it("recusa a confirmação com motivo claro, sem consultar o Asaas nem aplicar a ação", async () => {
    const result = await build().confirmTeamPayment({ supabaseId: "sb-1", paymentId: "provider-bill_1" })

    expect(result.isValid).toBe(false)
    expect(result.result).toMatchObject({ reason: "payment_not_confirmed" })
    expect(result.errorMessages).toEqual([
      "Cobrança AbacatePay é confirmada pelo provedor; a confirmação não passa por esta rota",
    ])
    expect(createAsaasClientMock).not.toHaveBeenCalled()
    expect(applyPendingActionByPaymentIdMock).not.toHaveBeenCalled()
  })

  it("cobrança Asaas continua confirmada pelo Asaas", async () => {
    pendingActionRepo.findByPaymentIdAndMasterId.mockImplementation(async () => asaasLookup as any)
    asaasRequestMock.mockImplementation(async () => ({ status: "CONFIRMED" }))

    const result = await build().confirmTeamPayment({ supabaseId: "sb-1", paymentId: "pay_1" })

    expect(result.isValid).toBe(true)
    expect(createAsaasClientMock).toHaveBeenCalledWith("primary")
    expect(applyPendingActionByPaymentIdMock).toHaveBeenCalledWith("pay_1", "primary")
  })
})
