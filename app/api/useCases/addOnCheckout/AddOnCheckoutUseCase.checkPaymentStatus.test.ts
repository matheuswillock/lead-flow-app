import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-40.19/T-40.20 de [[40 — Checkout, Adesões e Add-ons — Backend]] (E6/C32):
// checkPaymentStatus roteia por conta e nunca vira "pendente para sempre"
// quando o provedor está indisponível — degrada para o status persistido.

const findApplicableByIdMock = mock(async (_id: string) => baseAction)
const updateStatusMock = mock(async () => {})
const applyPendingActionByPaymentIdMock = mock(async () => {
  const { Output } = await import("@/lib/output")
  return new Output(true, [], [], null)
})

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: {
    findApplicableById: findApplicableByIdMock,
    updateStatus: updateStatusMock,
  },
}))

mock.module("@/app/api/useCases/pendingActions/PendingActionUseCase", () => ({
  pendingActionUseCase: {
    applyPendingActionByPaymentId: applyPendingActionByPaymentIdMock,
  },
}))

mock.module("@/app/api/services/billing/IncrementalBillingService", () => ({
  incrementalBillingService: {},
}))

const requestLog: Array<{ account: string; method?: string }> = []
const requestImplByAccount: Record<string, () => Promise<any>> = {}

function endpointsFor(accountId: string) {
  return { payments: `https://sandbox.asaas.com/api/v3/payments?account=${accountId}` }
}

mock.module("@/lib/asaas", () => ({
  asaas: async () => ({}),
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

const { AddOnCheckoutUseCase } = await import("./AddOnCheckoutUseCase")

const baseAction = {
  id: "pa-1",
  masterId: "master-1",
  teamId: "team-1",
  actionType: "update_subscription_credits" as const,
  status: "pending" as const,
  payload: {},
  checkoutId: null,
  paymentId: "pay_legacy_1",
  // Achado Codex (PR #1137, P1): conta persistida no instante em que o
  // paymentId nasceu — checkPaymentStatus lê daqui, não de
  // master.asaasCustomerAccount (que pode ter migrado desde então).
  asaasAccount: "legacy" as const,
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

describe("AddOnCheckoutUseCase.checkPaymentStatus — polling roteado por conta (E6/C32)", () => {
  beforeEach(() => {
    requestLog.length = 0
    findApplicableByIdMock.mockClear()
    findApplicableByIdMock.mockImplementation(async () => ({ ...baseAction }))
    updateStatusMock.mockClear()
    applyPendingActionByPaymentIdMock.mockClear()
    requestImplByAccount.legacy = async () => ({ status: "PENDING", value: 180, dueDate: "2026-09-10" })
    requestImplByAccount.primary = async () => ({ status: "PENDING", value: 180, dueDate: "2026-09-10" })
  })

  it("T-40.19: consulta o transporte da conta do master (legacy) e devolve o status real", async () => {
    const useCase = new AddOnCheckoutUseCase()

    const result = await useCase.checkPaymentStatus("pa-1")

    expect(result.isValid).toBe(true)
    expect(requestLog).toHaveLength(1)
    expect(requestLog[0].account).toBe("legacy")
    expect((result.result as any).status).toBe("PENDING")
  })

  it("T-40.20 (equivalente): Asaas indisponível → devolve o status persistido, nunca erro/pendente eterno", async () => {
    requestImplByAccount.legacy = async () => {
      const error = new Error("Not found")
      ;(error as { statusCode?: number }).statusCode = 404
      throw error
    }
    findApplicableByIdMock.mockImplementation(async () => ({ ...baseAction, status: "applied" }))

    const useCase = new AddOnCheckoutUseCase()
    const result = await useCase.checkPaymentStatus("pa-1")

    expect(result.isValid).toBe(true)
    const payload = result.result as { status: string; pendingActionStatus: string; amount: number | null }
    expect(payload.status).toBe("CONFIRMED")
    expect(payload.pendingActionStatus).toBe("applied")
    expect(payload.amount).toBeNull()
  })
})
