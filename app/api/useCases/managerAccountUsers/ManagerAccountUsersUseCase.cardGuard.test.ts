import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { stubCardEnabledConfig } from "@/test/support/card-enabled-config"
import {
  assertCardChoiceAllowedForAccount,
  type FetchSubscriptionCardInfo,
} from "@/lib/payment-methods/existing-card-subscriber"

// O provider (Asaas) é a única parte trocada: a regra de isenção é a real.
let fetchCardInfo: FetchSubscriptionCardInfo = async () => ({ billingType: "PIX" })
mock.module("@/app/api/services/billing/ExistingCardSubscriberService", () => ({
  assertCardChoiceAllowedForMaster: (
    billingType: unknown,
    master: Parameters<typeof assertCardChoiceAllowedForAccount>[1]
  ) =>
    assertCardChoiceAllowedForAccount(typeof billingType === "string" ? billingType : null, master, (s) =>
      fetchCardInfo(s)
    ),
}))

mock.module("server-only", () => ({}))
mock.module("@/lib/utils/app-url", () => ({ getFullUrl: (p: string) => `https://example.test${p}` }))
mock.module("@/lib/supabase/email-auth-link", () => ({ buildSetPasswordEmailAuthLink: () => "https://example.test/x" }))
mock.module("@/app/api/useCases/audit/AuditLogWriter", () => ({ auditLogWriter: { logAudit: async () => {} } }))
mock.module("@/lib/supabase/server", () => ({ createSupabaseAdmin: () => ({ auth: { admin: {} } }) }))
const sendPending = mock(async () => {})
const emailServiceStub = {
  sendOperatorInviteEmail: async () => {},
  sendGenericEmail: async () => {},
  sendEmail: async () => {},
  sendAddOnPendingPaymentEmail: sendPending,
}
mock.module("@/lib/services/EmailService", () => ({
  EmailService: class {},
  createEmailService: () => emailServiceStub,
  getEmailService: () => emailServiceStub,
  emailService: emailServiceStub,
}))

const { ManagerAccountUsersUseCase } = await import("./ManagerAccountUsersUseCase")
const { isMethodUnavailableOutput } = await import("@/lib/payment-methods/route-guard")

const originalEnv = { ...process.env }

function build(cardInfoFetcher: FetchSubscriptionCardInfo) {
  fetchCardInfo = cardInfoFetcher
  const repository = {
    findTeamNameById: mock(async () => ({ name: "Time" })),
    findProfileLabelById: mock(async () => ({ fullName: "Gestor" })),
    findProfileEmailById: mock(async () => ({ email: "gestor@test.com", fullName: "Gestor" })),
    findProfileIdByEmail: mock(async () => null),
    findOpenPendingOperatorIdByEmail: mock(async () => null),
    findOpenAddUserActionIdByEmail: mock(async () => null),
    findBillingOwnerProfile: mock(async () => ({
      id: "m1",
      email: "master@test.com",
      fullName: "Master",
      hasPermanentSubscription: false,
      asaasCustomerId: "cus_1",
      asaasSubscriptionId: "sub_1",
      asaasSubscriptionAccount: "primary",
      subscriptionStatus: "active",
    })),
    createPendingAddUserAction: mock(async () => ({ id: "pa1" })),
    updatePendingActionPayload: mock(async () => {}),
  }
  const billing = {
    projectBilling: mock(async () => ({ billingDelta: 30, targetRecurringTotal: 130 })),
    calculateProportionalAmount: mock(async () => ({
      billingDelta: 30,
      totalCharge: 60,
      remainingMonths: 2,
      maxInstallments: 2,
    })),
  }
  const memberProBilling = { shouldBypassIncrementalCharge: mock(async () => false) }
  const useCase = new ManagerAccountUsersUseCase(
    repository as never,
    {} as never,
    billing as never,
    {} as never,
    {} as never,
    memberProBilling as never,
  )
  return { useCase, repository }
}

const params = (billingType: string) =>
  ({
    ctx: { teamId: "t1", profileId: "pf1", managerId: "m1", isMaster: true },
    userData: { name: "Novo", email: "novo@test.com", role: "OPERATOR", billingType },
  }) as never

describe("ManagerAccountUsersUseCase.createAccountUser — cartão desligado", () => {
  let restoreConfig: () => void = () => undefined

  beforeEach(() => {
    restoreConfig = stubCardEnabledConfig(false)
    sendPending.mockClear()
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = "PRODUCTION"
    delete process.env.ABACATE_PAY_PRODUCTION_PUBLIC_KEY
    delete process.env.CARD_PAYMENTS_ENABLED
  })
  afterEach(() => {
    restoreConfig()
    process.env = { ...originalEnv }
  })

  it("CREDIT_CARD sem cartão existente -> 422 marcado, sem pending action nem e-mail", async () => {
    const { useCase, repository } = build(async () => ({ billingType: "PIX" }))

    const { output, status } = await useCase.createAccountUser(params("CREDIT_CARD"))

    expect(status).toBe(422)
    expect(isMethodUnavailableOutput(output)).toBe(true)
    expect(repository.createPendingAddUserAction).not.toHaveBeenCalled()
    expect(sendPending).not.toHaveBeenCalled()
  })

  it("assinante com cartão tokenizado -> segue e cria a pending action", async () => {
    const { useCase, repository } = build(async () => ({ billingType: "CREDIT_CARD", creditCardToken: "tok_1" }))

    const { output } = await useCase.createAccountUser(params("CREDIT_CARD"))

    expect(output.isValid).toBe(true)
    expect(repository.createPendingAddUserAction).toHaveBeenCalledTimes(1)
  })

  it("PIX passa", async () => {
    const { useCase, repository } = build(async () => ({ billingType: "PIX" }))

    const { output } = await useCase.createAccountUser(params("PIX"))

    expect(output.isValid).toBe(true)
    expect(repository.createPendingAddUserAction).toHaveBeenCalledTimes(1)
  })
})
