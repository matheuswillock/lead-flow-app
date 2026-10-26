import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"

const manager = {
  id: "m1",
  role: "manager",
  fullName: "Master",
  email: "m@x.com",
  subscriptionStatus: "active",
  asaasSubscriptionId: null as string | null,
  asaasSubscriptionAccount: "primary",
  subscriptionEndDate: null,
  subscriptionNextDueDate: null,
}

const profileFindUnique = mock(async () => ({ ...manager }))
const profileFindFirst = mock(async () => null)
const pendingActionCreate = mock(async () => ({ id: "pa-1" }))
mock.module("@/app/api/infra/data/prisma", () => ({
  default: {
    profile: { findUnique: profileFindUnique, findFirst: profileFindFirst, create: mock(async () => ({ id: "op" })) },
    team: { findUnique: mock(async () => ({ id: "t1", masterId: "m1" })) },
    pendingOperator: { findFirst: mock(async () => null) },
    pendingAction: { create: pendingActionCreate },
    teamMember: { create: mock(async () => ({})) },
  },
}))
mock.module("@/app/api/services/billing/IncrementalBillingService", () => ({
  incrementalBillingService: {
    calculateProportionalAmount: mock(async () => ({
      billingDelta: 50,
      totalCharge: 100,
      remainingMonths: 2,
      maxInstallments: 2,
    })),
  },
}))
mock.module("@/app/api/useCases/billing/MemberProBillingUseCase", () => ({
  memberProBillingUseCase: { shouldBypassIncrementalCharge: mock(async () => false) },
}))
const sendPendingEmail = mock(async () => {})
mock.module("@/lib/services/EmailService", () => ({
  emailService: { sendAddOnPendingPaymentEmail: sendPendingEmail, sendAddOnConfirmedEmail: mock(async () => {}) },
}))
mock.module("@/lib/utils/app-url", () => ({ getFullUrl: (p: string) => `https://app.local${p}` }))

let subscriptionBillingType = "CREDIT_CARD"
mock.module("@/lib/asaas", () => ({
  createAsaasClient: () => ({
    endpoints: { subscriptions: "subscriptions" },
    request: async () => ({ billingType: subscriptionBillingType, creditCard: { creditCardToken: "tok_1" } }),
  }),
}))

const { POST } = await import("./route")

const originalEnv = { ...process.env }

function makeRequest(billingType: string) {
  return new NextRequest("http://localhost/api/v1/operators/payments/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      managerId: "sb-1",
      teamId: "t1",
      billingType,
      operatorData: { name: "Op", email: "op@x.com" },
    }),
  })
}

describe("POST /operators/payments/create — cartão desligado", () => {
  beforeEach(() => {
    manager.asaasSubscriptionId = null
    subscriptionBillingType = "CREDIT_CARD"
    pendingActionCreate.mockClear()
    sendPendingEmail.mockClear()
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
    delete process.env.CARD_PAYMENTS_ENABLED
  })
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it("CREDIT_CARD de quem não tem cartão -> 422 sem pending action nem e-mail", async () => {
    const response = await POST(makeRequest("CREDIT_CARD"))

    expect(response.status).toBe(422)
    expect(pendingActionCreate).not.toHaveBeenCalled()
    expect(sendPendingEmail).not.toHaveBeenCalled()
  })

  it("CREDIT_CARD de assinante com cartão e token -> passa (cobrança incremental)", async () => {
    manager.asaasSubscriptionId = "sub_1"

    const response = await POST(makeRequest("CREDIT_CARD"))

    expect(response.status).toBe(201)
    expect(pendingActionCreate).toHaveBeenCalledTimes(1)
  })

  it("assinatura em PIX não dá isenção de cartão", async () => {
    manager.asaasSubscriptionId = "sub_1"
    subscriptionBillingType = "PIX"

    const response = await POST(makeRequest("CREDIT_CARD"))

    expect(response.status).toBe(422)
  })

  it("PIX sempre passa", async () => {
    const response = await POST(makeRequest("PIX"))

    expect(response.status).toBe(201)
  })

  it("CARD_PAYMENTS_ENABLED=false bloqueia quem não tem cartão mesmo com a chave pública", async () => {
    process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY = "pk_live_x"
    process.env.CARD_PAYMENTS_ENABLED = "false"

    const response = await POST(makeRequest("CREDIT_CARD"))

    expect(response.status).toBe(422)
  })
})
