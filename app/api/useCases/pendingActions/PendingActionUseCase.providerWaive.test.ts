import { beforeEach, describe, expect, it, mock } from "bun:test"

// Regressão: uma action ABACATE_PAY guarda paymentId como `provider-<externalId>`.
// A dispensa sem cobrança é um fluxo Asaas; consultar o Asaas com esse id dá 404,
// que o fluxo trata como "já cancelada" (fail-open) e aplicaria a licença sem
// verificar a cobrança AbacatePay. Essa action não pode ser dispensada aqui.

const runInTransactionMock = mock(async (_cb: unknown) => ({ teamId: "team-1" }))
const clearPaymentIdMock = mock(async () => {})
const findApplicableByIdMock = mock(async (_id: string) => baseAction)
const findApplicableByPaymentIdMock = mock(async (_paymentId: string, _account: string) => null as any)
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
  provider: "ABACATE_PAY" as const,
  payload: { email: "novo@example.test", name: "Novo", role: "operator", teamId: "team-1" },
  checkoutId: null,
  paymentId: "provider-xyz",
  asaasAccount: null,
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

describe("PendingActionUseCase — dispensa não aceita cobrança AbacatePay", () => {
  beforeEach(() => {
    requestLog.length = 0
    clearPaymentIdMock.mockClear()
    runInTransactionMock.mockClear()
    findApplicableByIdMock.mockClear()
    findApplicableByIdMock.mockImplementation(async () => ({ ...baseAction }))
    findApplicableByPaymentIdMock.mockClear()
    findApplicableByPaymentIdMock.mockImplementation(async () => null)
    requestImplByAccount.primary = async () => {
      throw statusError(404)
    }
    requestImplByAccount.legacy = async () => {
      throw statusError(404)
    }
  })

  it("action ABACATE_PAY não é consultada no Asaas, não é aplicada e retorna erro pt-BR", async () => {
    const useCase = new PendingActionUseCase()
    const result = await useCase.forceApplyPendingActionWithoutCharge("pa-1", { reason: "teste" })

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toContain("Cobrança do provedor de pagamento não pode ser dispensada por este fluxo")
    expect(requestLog).toHaveLength(0)
    expect(runInTransactionMock).not.toHaveBeenCalled()
    expect(clearPaymentIdMock).not.toHaveBeenCalled()
  })
})
