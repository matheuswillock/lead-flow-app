import { beforeEach, describe, expect, it, mock } from "bun:test"

const abacateAction = {
  id: "pa-1",
  masterId: "master-1",
  teamId: null,
  actionType: "add_user" as const,
  status: "pending" as const,
  payload: { billingType: "CREDIT_CARD", totalCharge: 100 },
  checkoutId: null,
  paymentId: null,
  asaasAccount: null,
  provider: "ABACATE_PAY",
  providerAttemptId: "att-1",
  providerExternalId: "bill_1",
  createdAt: new Date(),
  updatedAt: new Date(),
  master: { id: "master-1" },
} as any

const findByIdSimpleMock = mock(async (_id: string) => ({ ...abacateAction }) as any)
const findByIdMock = mock(async (_id: string) => ({ ...abacateAction }) as any)
const updatePayloadMock = mock(async (_id: string, _payload: unknown) => {})
const findAttemptByIdMock = mock(async (_id: string) => ({ id: "att-1", status: "PENDING" }) as any)

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: {
    findByIdSimple: findByIdSimpleMock,
    findById: findByIdMock,
    updatePayload: updatePayloadMock,
    updateStatus: mock(async () => {}),
    clearPaymentId: mock(async () => {}),
    updatePaymentId: mock(async () => {}),
  },
}))
mock.module("@/app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository", () => ({
  paymentProviderSessionRepository: { findAttemptById: findAttemptByIdMock },
}))
mock.module("@/app/api/useCases/pendingActions/PendingActionUseCase", () => ({ pendingActionUseCase: {} }))
mock.module("@/app/api/services/billing/IncrementalBillingService", () => ({ incrementalBillingService: {} }))

const { AddOnCheckoutUseCase } = await import("./AddOnCheckoutUseCase")

describe("AddOnCheckoutUseCase.updateBillingType — troca de forma com pagamento AbacatePay", () => {
  beforeEach(() => {
    findByIdSimpleMock.mockImplementation(async () => ({ ...abacateAction }) as any)
    findAttemptByIdMock.mockImplementation(async () => ({ id: "att-1", status: "PENDING" }) as any)
    updatePayloadMock.mockClear()
    findAttemptByIdMock.mockClear()
  })

  it("permite trocar a forma enquanto a cobrança AbacatePay não foi paga", async () => {
    const result = await new AddOnCheckoutUseCase().updateBillingType("pa-1", "PIX")

    expect(result.isValid).toBe(true)
    expect(findAttemptByIdMock).toHaveBeenCalledWith("att-1")
    expect(updatePayloadMock).toHaveBeenCalledTimes(1)
  })

  it("recusa a troca quando a tentativa AbacatePay já está confirmada", async () => {
    findAttemptByIdMock.mockImplementation(async () => ({ id: "att-1", status: "CONFIRMED" }) as any)

    const result = await new AddOnCheckoutUseCase().updateBillingType("pa-1", "PIX")

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual(["Pagamento já confirmado; a forma de pagamento não pode ser trocada"])
    expect(updatePayloadMock).not.toHaveBeenCalled()
  })

  it("não consulta tentativa quando a ação não é AbacatePay", async () => {
    findByIdSimpleMock.mockImplementation(async () => ({ ...abacateAction, provider: null, providerAttemptId: null }) as any)

    const result = await new AddOnCheckoutUseCase().updateBillingType("pa-1", "PIX")

    expect(result.isValid).toBe(true)
    expect(findAttemptByIdMock).not.toHaveBeenCalled()
  })
})
