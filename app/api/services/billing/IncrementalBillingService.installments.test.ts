import { beforeEach, describe, expect, it, mock } from "bun:test"

// Parcelamento por ciclo (D6 em DOC/Implementation/assinaturas-add-ons-abacatepay/05-decisoes.md):
// o máximo de parcelas do add-on proporcional sai do ciclo do contrato, limitado aos meses restantes.

const getBillingSnapshotMock = mock(async () => ({
  hasPermanentSubscription: false,
  hasUnlimitedUsers: false,
  teamCount: 1,
  distinctUserCount: 0,
  totalUsersIncludingMaster: 1,
  includedExtraTeams: 0,
  includedExtraUsers: 0,
  manualAdjustmentExtraTeams: 0,
  manualAdjustmentExtraUsers: 0,
}))
const getSubscriptionEndDateMock = mock(async () => new Date(Date.now() + 400 * 24 * 60 * 60 * 1000))
const getSubscriptionCycleMock = mock(async (): Promise<string | null> => "annual")

mock.module("@/app/api/infra/data/repositories/billing/BillingRepository", () => ({
  billingRepository: {
    getBillingSnapshot: getBillingSnapshotMock,
    getSubscriptionEndDate: getSubscriptionEndDateMock,
    getSubscriptionCycle: getSubscriptionCycleMock,
    updateAsaasCustomerId: mock(async () => {}),
    updateSubscriptionData: mock(async () => {}),
  },
}))

mock.module("@/app/api/infra/data/repositories/pendingAction/PendingActionRepository", () => ({
  pendingActionRepository: { attachProviderAttempt: mock(async () => ({})) },
}))

mock.module("@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway", () => ({
  asaasCustomerGateway: { createCustomer: mock(async () => ({ id: "cus" })) },
}))

const { incrementalBillingService } = await import("./IncrementalBillingService")

describe("IncrementalBillingService.calculateProportionalAmount — parcelas pelo ciclo", () => {
  beforeEach(() => {
    getSubscriptionEndDateMock.mockImplementation(async () => new Date(Date.now() + 400 * 24 * 60 * 60 * 1000))
  })

  it("contrato anual com mais de 12 meses restantes permite 12x", async () => {
    getSubscriptionCycleMock.mockImplementation(async () => "annual")

    const data = await incrementalBillingService.calculateProportionalAmount("master-1", "user")

    expect(data.billingDelta).toBeGreaterThan(0)
    expect(data.maxInstallments).toBe(12)
  })

  it("contrato mensal permite só 1x, mesmo com meses restantes de sobra", async () => {
    getSubscriptionCycleMock.mockImplementation(async () => "MONTHLY")

    const data = await incrementalBillingService.calculateProportionalAmount("master-1", "user")

    expect(data.maxInstallments).toBe(1)
    expect(data.remainingMonths).toBeGreaterThan(1)
  })

  it("contrato anual com poucos meses restantes não passa dos meses que faltam", async () => {
    getSubscriptionCycleMock.mockImplementation(async () => "annual")
    getSubscriptionEndDateMock.mockImplementation(async () => new Date(Date.now() + 40 * 24 * 60 * 60 * 1000))

    const data = await incrementalBillingService.calculateProportionalAmount("master-1", "user")

    expect(data.maxInstallments).toBe(1)
  })
})
