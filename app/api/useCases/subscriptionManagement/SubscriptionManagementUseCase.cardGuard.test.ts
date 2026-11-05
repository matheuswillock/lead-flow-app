import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { stubCardEnabledConfig } from "@/test/support/card-enabled-config"

const owner = {
  id: "owner-1",
  fullName: "Master",
  email: "m@x.com",
  isMaster: true,
  hasPermanentSubscription: false,
  hasUnlimitedUsers: false,
  asaasSubscriptionId: null as string | null,
  asaasSubscriptionAccount: "primary",
}

const findUniqueMock = mock(async (args: { where: { supabaseId?: string; id?: string } }) =>
  args.where.supabaseId ? { id: "owner-1", isMaster: true, managerId: null } : { ...owner }
)
const pendingActionCreate = mock(async () => ({ id: "pa-1" }))
const prismaMock = {
  profile: { findUnique: findUniqueMock },
  pendingAction: { create: pendingActionCreate },
  profileSubscription: { findUnique: mock(async () => null) },
}
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: prismaMock, default: prismaMock }))
mock.module("@/app/api/services/billing/TeamBillingService", () => ({
  getBillingSummary: mock(async () => ({ hasUnlimitedUsers: false, totalPrice: 100 })),
}))
mock.module("@/app/api/services/billing/AsaasSubscriptionSyncService", () => ({
  asaasSubscriptionSyncService: { syncFromAsaas: mock(async () => {}) },
}))
mock.module("@/app/api/services/billing/SubscriptionCreditService", () => ({
  subscriptionCreditService: {
    projectCreditAddition: mock(async () => ({ billingDelta: 30, targetRecurringTotal: 130 })),
  },
}))
mock.module("@/app/api/services/billing/IncrementalBillingService", () => ({ incrementalBillingService: {} }))
mock.module("@/app/api/infra/data/repositories/billing/BillingRepository", () => ({
  billingRepository: { getSubscriptionEndDate: mock(async () => null) },
}))
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({ AsaasSubscriptionService: {} }))

mock.module("@/lib/utils/app-url", () => ({ getFullUrl: (p: string) => `https://app.local${p}` }))

let subscriptionBillingType = "CREDIT_CARD"
mock.module("@/lib/asaas", () => ({
  createAsaasClient: () => ({
    endpoints: { subscriptions: "subscriptions", payments: "payments" },
    request: async () => ({ billingType: subscriptionBillingType, creditCard: { creditCardToken: "tok_1" } }),
  }),
  asaasFetch: mock(async () => ({})),
  asaasApi: { payments: "payments", subscriptions: "subscriptions" },
}))

const { SubscriptionManagementUseCase } = await import("./SubscriptionManagementUseCase")
const { isMethodUnavailableOutput } = await import("@/lib/payment-methods/route-guard")

const originalEnv = { ...process.env }
const input = (billingType: string) =>
  ({ action: "add", resource: "team", quantity: 1, billingType }) as never

describe("SubscriptionManagementUseCase.updateCredits — cartão desligado", () => {
  let restoreConfig: () => void = () => undefined

  beforeEach(() => {
    restoreConfig = stubCardEnabledConfig(false)
    owner.asaasSubscriptionId = null
    subscriptionBillingType = "CREDIT_CARD"
    pendingActionCreate.mockClear()
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
    delete process.env.CARD_PAYMENTS_ENABLED
  })
  afterEach(() => {
    restoreConfig()
    process.env = { ...originalEnv }
  })

  it("CREDIT_CARD sem cartão existente -> erro marcado (422) e sem pending action", async () => {
    const output = await new SubscriptionManagementUseCase().updateCredits("sb-1", input("CREDIT_CARD"))

    expect(output.isValid).toBe(false)
    expect(isMethodUnavailableOutput(output)).toBe(true)
    expect(pendingActionCreate).not.toHaveBeenCalled()
  })

  it("assinante com cartão tokenizado -> cria a pending action em cartão", async () => {
    owner.asaasSubscriptionId = "sub_1"

    const output = await new SubscriptionManagementUseCase().updateCredits("sb-1", input("CREDIT_CARD"))

    expect(output.isValid).toBe(true)
    expect(pendingActionCreate).toHaveBeenCalledTimes(1)
  })

  it("PIX passa", async () => {
    const output = await new SubscriptionManagementUseCase().updateCredits("sb-1", input("PIX"))

    expect(output.isValid).toBe(true)
  })

  it("CARD_PAYMENTS_ENABLED=false bloqueia quem não tem cartão mesmo com a chave pública", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    process.env.CARD_PAYMENTS_ENABLED = "false"

    const output = await new SubscriptionManagementUseCase().updateCredits("sb-1", input("CREDIT_CARD"))

    expect(isMethodUnavailableOutput(output)).toBe(true)
  })
})
