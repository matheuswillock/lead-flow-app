import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-40.10 a T-40.12 de [[40 — Checkout, Adesões e Add-ons — Backend]] (E3):
// waive nunca fica preso; roteia por conta; fail-open quando o payment não
// existe em nenhuma conta.

const runInTransactionMock = mock(async (_cb: unknown) => ({ teamId: "team-1" }))
const clearPaymentIdMock = mock(async () => {})
const findApplicableByIdMock = mock(async (_id: string) => baseAction)
const findApplicableByPaymentIdMock = mock(async (_paymentId: string) => null as any)
const markFailedMock = mock(async () => {})
const updatePayloadMock = mock(async () => {})

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: {
    findApplicableById: findApplicableByIdMock,
    findApplicableByPaymentId: findApplicableByPaymentIdMock,
    runInTransaction: runInTransactionMock,
    clearPaymentId: clearPaymentIdMock,
    markFailed: markFailedMock,
    updatePayload: updatePayloadMock,
  },
}))

mock.module("@/app/api/useCases/billing/MemberProBillingUseCase", () => ({
  memberProBillingUseCase: {
    shouldBypassIncrementalCharge: mock(async () => true),
    getMemberProContext: mock(async () => ({ isActive: false })),
    syncUsageToSubscription: mock(async () => {}),
  },
}))

const requestLog: Array<{ account: string; url: string; method?: string }> = []
const requestImplByAccount: Record<string, (url: string, method?: string) => Promise<any>> = {}

function endpointsFor(accountId: string) {
  return {
    payments: `https://sandbox.asaas.com/api/v3/payments?account=${accountId}`,
  }
}

const asaasFetchMock = mock(async (_url: string, _init?: RequestInit) => ({}))

mock.module("@/lib/asaas", () => ({
  asaasApi: endpointsFor("primary"),
  asaasFetch: asaasFetchMock,
  createAsaasClient: (accountId: "primary" | "legacy") => ({
    endpoints: endpointsFor(accountId),
    request: async (url: string, init?: RequestInit) => {
      requestLog.push({ account: accountId, url, method: init?.method })
      const impl = requestImplByAccount[accountId]
      if (!impl) throw new Error(`sem mock de request configurado para a conta ${accountId}`)
      return impl(url, init?.method)
    },
  }),
}))

const { PendingActionUseCase } = await import("./PendingActionUseCase")

function statusError(statusCode: number, message = "erro"): Error {
  const error = new Error(message)
  ;(error as { statusCode?: number }).statusCode = statusCode
  return error
}

const baseAction = {
  id: "pa-1",
  masterId: "master-1",
  teamId: "team-1",
  actionType: "add_user" as const,
  status: "pending" as const,
  payload: { email: "novo@example.test", name: "Novo", role: "operator", teamId: "team-1" },
  checkoutId: null,
  paymentId: "pay_1",
  createdAt: new Date(),
  updatedAt: new Date(),
  master: {
    id: "master-1",
    fullName: "Master",
    email: "master@example.test",
    functions: [],
    cpfCnpj: null,
    phone: null,
    postalCode: null,
    address: null,
    addressNumber: null,
    neighborhood: null,
    complement: null,
    asaasCustomerId: "cus_legacy_1",
    asaasCustomerAccount: "legacy" as const,
    asaasSubscriptionId: null,
    asaasSubscriptionAccount: "primary" as const,
    subscriptionStatus: null,
    subscriptionNextDueDate: null,
    subscriptionCycle: null,
    hasPermanentSubscription: false,
    hasUnlimitedUsers: false,
    timezone: "America/Sao_Paulo",
  },
} as any

describe("PendingActionUseCase — dispensa nunca fica presa (E3/C20)", () => {
  beforeEach(() => {
    requestLog.length = 0
    clearPaymentIdMock.mockClear()
    runInTransactionMock.mockClear()
    findApplicableByIdMock.mockClear()
    findApplicableByIdMock.mockImplementation(async () => ({ ...baseAction, paymentId: "pay_1" }))
    requestImplByAccount.primary = async () => {
      throw statusError(404)
    }
    requestImplByAccount.legacy = async () => {
      throw statusError(404)
    }
  })

  it("T-40.10: waive com pay_ legacy roteia GET/DELETE para o transporte legacy e dispensa com sucesso", async () => {
    requestImplByAccount.legacy = async (_url: string, method?: string) => {
      if (method === "GET") return { status: "PENDING" }
      if (method === "DELETE") return {}
      return {}
    }

    const useCase = new PendingActionUseCase()
    const result = await useCase.forceApplyPendingActionWithoutCharge("pa-1", { reason: "teste" })

    expect(result.isValid).toBe(true)
    expect(clearPaymentIdMock).toHaveBeenCalledWith("pa-1")

    const legacyCalls = requestLog.filter((c) => c.account === "legacy")
    expect(legacyCalls.some((c) => c.method === "GET")).toBe(true)
    expect(legacyCalls.some((c) => c.method === "DELETE")).toBe(true)
    // nenhuma chamada vazou para a primary quando a conta correta é legacy
    expect(requestLog.some((c) => c.account === "primary")).toBe(false)
  })

  it("T-40.11: 404 nas duas contas → dispensa prossegue (payment tratado como inexistente)", async () => {
    requestImplByAccount.legacy = async () => {
      throw statusError(404)
    }
    requestImplByAccount.primary = async () => {
      throw statusError(404)
    }

    const consoleErrorSpy = mock((..._args: unknown[]) => {})
    const originalError = console.error
    console.error = consoleErrorSpy as unknown as typeof console.error

    try {
      const useCase = new PendingActionUseCase()
      const result = await useCase.forceApplyPendingActionWithoutCharge("pa-1", { reason: "teste" })

      expect(result.isValid).toBe(true)
      expect(clearPaymentIdMock).toHaveBeenCalledWith("pa-1")
      expect(
        consoleErrorSpy.mock.calls.some((call) =>
          String(call[0]).includes("não encontrada em nenhuma conta")
        )
      ).toBe(true)
    } finally {
      console.error = originalError
    }
  })

  it("T-40.12: applyPendingActionByPaymentId usa a conta do evento de webhook (legacy) no lookup por externalReference", async () => {
    requestImplByAccount.legacy = async (_url: string, method?: string) => {
      if (method === "GET") {
        return { externalReference: "pending-action-nao-existe-mais" }
      }
      return {}
    }
    findApplicableByIdMock.mockImplementation(async () => null)

    const useCase = new PendingActionUseCase()
    const result = await useCase.applyPendingActionByPaymentId("pay_evento_legacy", "legacy")

    expect(result.isValid).toBe(false)
    const legacyGet = requestLog.find((c) => c.account === "legacy" && c.method === "GET")
    expect(legacyGet).toBeDefined()
    expect(requestLog.some((c) => c.account === "primary")).toBe(false)
  })

  it("achado Codex (PR #1137, P1): paymentId colidindo entre contas não aplica a ação da conta errada", async () => {
    // findApplicableByPaymentId acha uma ação, mas ela pertence ao master
    // primary — o evento é da conta legacy (mesmo paymentId, colisão C33).
    findApplicableByIdMock.mockImplementation(async () => null)
    findApplicableByPaymentIdMock.mockImplementation(async () => ({
      ...baseAction,
      master: { ...baseAction.master, asaasCustomerAccount: "primary" },
    }))
    requestImplByAccount.legacy = async (_url: string, method?: string) => {
      if (method === "GET") return { externalReference: "pending-action-nao-existe" }
      return {}
    }

    const useCase = new PendingActionUseCase()
    const result = await useCase.applyPendingActionByPaymentId("pay_colidindo", "legacy")

    expect(result.isValid).toBe(false)
    expect(runInTransactionMock).not.toHaveBeenCalled()
    // a ação da conta errada nunca foi aplicada — o lookup caiu no fallback
    // por externalReference, escopado pela conta legacy do evento
    const legacyGet = requestLog.find((c) => c.account === "legacy" && c.method === "GET")
    expect(legacyGet).toBeDefined()
  })
})
