import { beforeEach, describe, expect, it, mock } from "bun:test"

// Ação com provedor registrado: a rota consulta o PRÓPRIO provedor (agnóstico) e só aplica quando ele
// confirma. Ação legada (sem provedor) segue pelo Asaas.

const asaasRequestMock = mock(async (_endpoint: string, _options?: unknown): Promise<unknown> => {
  throw new Error("Asaas não deveria ser chamado para cobrança de provedor")
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
  findByPaymentIdAndMasterId: mock(async (_paymentId: string, _masterId: string) => providerLookup as any),
  findByIdSimple: mock(async (_id: string) => null),
  updatePaymentId: mock(async () => {}),
}
const providerPayment = {
  settle: mock(async (_action: { id: string; providerAttemptId: string | null }): Promise<any> => ({
    outcome: "settled",
  })),
}

const providerLookup = {
  id: "pa-1",
  masterId: "profile-master-1",
  status: "pending",
  asaasAccount: null,
  provider: "SOME_PROVIDER",
  providerAttemptId: "attempt-1",
}
const asaasLookup = { ...providerLookup, provider: null, providerAttemptId: null, asaasAccount: "primary" }

const build = () =>
  new ConfirmTeamPaymentUseCase(
    profileRepo as any,
    teamMembersRepo as any,
    pendingActionRepo as any,
    providerPayment as any,
  )

const runConfirm = (paymentId = "provider-ext_1") =>
  build().confirmTeamPayment({ supabaseId: "sb-1", paymentId })

describe("ConfirmTeamPaymentUseCase — ação de provedor consulta o provedor", () => {
  beforeEach(() => {
    pendingActionRepo.findByPaymentIdAndMasterId.mockImplementation(async () => providerLookup as any)
    providerPayment.settle.mockReset()
    providerPayment.settle.mockImplementation(async () => ({ outcome: "settled" }))
    asaasRequestMock.mockClear()
    createAsaasClientMock.mockClear()
    applyPendingActionByPaymentIdMock.mockClear()
  })

  it("pago: aplica a ação pela tentativa registrada, sem tocar no Asaas", async () => {
    const result = await runConfirm()

    expect(result.isValid).toBe(true)
    expect(providerPayment.settle).toHaveBeenCalledWith({ id: "pa-1", providerAttemptId: "attempt-1" })
    expect(createAsaasClientMock).not.toHaveBeenCalled()
    expect(applyPendingActionByPaymentIdMock).not.toHaveBeenCalled()
  })

  it("pendente: responde que o pagamento ainda não foi confirmado", async () => {
    providerPayment.settle.mockImplementation(async () => ({ outcome: "not_confirmed", status: "PENDING" }))

    const result = await runConfirm()

    expect(result.isValid).toBe(false)
    expect(result.result).toMatchObject({ reason: "payment_not_confirmed" })
    expect(result.errorMessages).toEqual(["Pagamento ainda não foi confirmado"])
  })

  it("indeterminado ou erro do provedor: falha clara, sem aplicar", async () => {
    providerPayment.settle.mockImplementation(async () => ({
      outcome: "indeterminate",
      message: "Não foi possível consultar o provedor de pagamento",
    }))

    const result = await runConfirm()

    expect(result.isValid).toBe(false)
    expect(result.result).toMatchObject({ reason: "payment_unverifiable" })
    expect(result.errorMessages).toEqual(["Não foi possível consultar o provedor de pagamento"])
    expect(applyPendingActionByPaymentIdMock).not.toHaveBeenCalled()
  })

  it("liquidação recusada (ex.: valor divergente): propaga a razão", async () => {
    providerPayment.settle.mockImplementation(async () => ({
      outcome: "settlement_failed",
      message: "Valor pago não confere com a cobrança do add-on",
    }))

    const result = await runConfirm()

    expect(result.isValid).toBe(false)
    expect(result.result).toMatchObject({ reason: "settlement_failed" })
    expect(result.errorMessages).toEqual(["Valor pago não confere com a cobrança do add-on"])
  })

  it("ação de outra conta: action_not_owned, sem consultar o provedor", async () => {
    pendingActionRepo.findByPaymentIdAndMasterId.mockImplementation(
      async () => ({ ...providerLookup, masterId: "outro-master" }) as any,
    )

    const result = await runConfirm()

    expect(result.isValid).toBe(false)
    expect(result.result).toMatchObject({ reason: "action_not_owned" })
    expect(providerPayment.settle).not.toHaveBeenCalled()
  })

  it("ação cancelada: action_canceled, sem consultar o provedor", async () => {
    pendingActionRepo.findByPaymentIdAndMasterId.mockImplementation(
      async () => ({ ...providerLookup, status: "canceled" }) as any,
    )

    const result = await runConfirm()

    expect(result.isValid).toBe(false)
    expect(result.result).toMatchObject({ reason: "action_canceled" })
    expect(providerPayment.settle).not.toHaveBeenCalled()
  })

  it("legado Asaas (sem provedor) continua confirmado pelo Asaas", async () => {
    pendingActionRepo.findByPaymentIdAndMasterId.mockImplementation(async () => asaasLookup as any)
    asaasRequestMock.mockImplementation(async () => ({ status: "CONFIRMED" }))

    const result = await runConfirm("pay_1")

    expect(result.isValid).toBe(true)
    expect(createAsaasClientMock).toHaveBeenCalledWith("primary")
    expect(applyPendingActionByPaymentIdMock).toHaveBeenCalledWith("pay_1", "primary")
    expect(providerPayment.settle).not.toHaveBeenCalled()
  })
})
