import { beforeEach, describe, expect, it, mock } from "bun:test"

// Achado Codex (PR #1137, P2): createPayment (retomada de cobrança já
// existente) e updateBillingType consultavam o Asaas via asaas() — helper
// legado sempre-primary — em vez de pendingAction.asaasAccount, a conta
// PERSISTIDA no instante em que o paymentId nasceu (C33/E6, mesmo achado já
// corrigido em checkPaymentStatus).

const findByIdMock = mock(async () => baseAction)
const findByIdSimpleMock = mock(async () => baseAction)
const updateStatusMock = mock(async () => {})
const updatePayloadMock = mock(async () => {})
const clearPaymentIdMock = mock(async () => {})

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: {
    findById: findByIdMock,
    findByIdSimple: findByIdSimpleMock,
    updateStatus: updateStatusMock,
    updatePayload: updatePayloadMock,
    clearPaymentId: clearPaymentIdMock,
  },
}))

mock.module("@/app/api/useCases/pendingActions/PendingActionUseCase", () => ({
  pendingActionUseCase: {},
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
  payload: { billingType: "PIX" },
  checkoutId: null,
  paymentId: "pay_legacy_1",
  asaasAccount: "legacy" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  master: { id: "master-1" },
} as any

describe("AddOnCheckoutUseCase.createPayment — retomada de cobrança existente roteada por conta (C33)", () => {
  beforeEach(() => {
    requestLog.length = 0
    findByIdMock.mockClear()
    findByIdMock.mockImplementation(async () => ({ ...baseAction }))
    requestImplByAccount.legacy = async () => ({ id: "pay_legacy_1", status: "PENDING", billingType: "CREDIT_CARD", value: 180, dueDate: "2026-09-10" })
    requestImplByAccount.primary = async () => {
      throw new Error("não deveria consultar a conta primary — o pagamento nasceu na legacy")
    }
  })

  it("achado Codex (PR #1137, P2): cobrança já existe na legacy — consulta roteia pela legacy, não pela primary", async () => {
    const useCase = new AddOnCheckoutUseCase()

    const result = await useCase.createPayment("pa-1", {
      billingType: "CREDIT_CARD",
      fullName: "Master Teste",
      email: "master@example.test",
      phone: "11999999999",
      cpfCnpj: "12345678900",
      postalCode: "01310100",
      address: "Av. Teste",
      addressNumber: "100",
      neighborhood: "Centro",
    })

    expect(result.isValid).toBe(true)
    expect(requestLog).toHaveLength(1)
    expect(requestLog[0].account).toBe("legacy")
  })
})

describe("AddOnCheckoutUseCase.updateBillingType — troca de forma de pagamento roteada por conta (C33)", () => {
  beforeEach(() => {
    requestLog.length = 0
    findByIdSimpleMock.mockClear()
    findByIdSimpleMock.mockImplementation(async () => ({ ...baseAction, payload: { billingType: "PIX" } }))
    clearPaymentIdMock.mockClear()
    requestImplByAccount.legacy = async () => ({ status: "PENDING" })
    requestImplByAccount.primary = async () => {
      throw new Error("não deveria consultar a conta primary — o pagamento nasceu na legacy")
    }
  })

  it("achado Codex (PR #1137, P2): cancelamento do pagamento pendente roteia GET/DELETE pela legacy", async () => {
    const useCase = new AddOnCheckoutUseCase()

    const result = await useCase.updateBillingType("pa-1", "CREDIT_CARD")

    expect(result.isValid).toBe(true)
    expect(requestLog.filter((c) => c.account === "legacy" && c.method === "DELETE")).toHaveLength(1)
    expect(requestLog.some((c) => c.account === "primary")).toBe(false)
  })
})
