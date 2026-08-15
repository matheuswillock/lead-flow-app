import { beforeEach, describe, expect, it, mock } from "bun:test"
import { EmailCreditPlan } from "@prisma/client"
import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { PlatformCheckoutUseCase } from "@/app/api/useCases/platformCheckout/PlatformCheckoutUseCase"

const subscriptionFindUniqueMock = mock(async () => null)
const teamFindUniqueMock = mock(async () => ({ master: { timezone: "America/Sao_Paulo" } }))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailCreditSubscription: {
      findUnique: subscriptionFindUniqueMock,
      update: mock(async () => ({})),
    },
    team: {
      findUnique: teamFindUniqueMock,
    },
    emailTeamSettings: {
      findUnique: mock(async () => null),
    },
  },
}))

const resolveEmailBetaAccessMock = mock(async () => false)
mock.module("@/app/api/services/featureAccess/FeatureAccessService", () => ({
  featureAccessService: {
    resolveEmailBetaAccess: resolveEmailBetaAccessMock,
  },
}))

mock.module("@/lib/email/campaign-daily-dispatch-guard", () => ({
  getTeamDailyDispatchStatus: mock(async () => ({
    limit: null,
    used: 0,
    remaining: null,
    isUnlimited: true,
  })),
}))

type CreateCheckoutArg = {
  purchaseType: string
  productSlug: string
  teamId?: string
  amount: number
  metadata?: { plan?: string }
}

const createCheckoutMock = mock(
  async (_input?: CreateCheckoutArg) =>
    new Output(true, ["Checkout criado"], [], {
      checkoutId: "purchase-1",
      purchaseId: "purchase-1",
      checkoutUrl: "https://app.test/addon-checkout/purchase-1",
      externalReference: "platform-purchase-purchase-1",
      status: "pending",
      purchaseType: "email_credits",
      productSlug: "email-credits-starter",
      teamId: "team-1",
      profileId: "profile-1",
    })
)

const getStatusMock = mock(async () => ({
  hasSubscription: false,
  plan: null,
  monthlyCredits: 0,
  creditsUsed: 0,
  creditsAvailable: 0,
  overageCount: 0,
  overageCharged: 0,
  currentPeriodEnd: null,
}))

const { EmailCreditUseCase } = await import("./EmailCreditUseCase")

const teamCtx: TeamAccess = {
  supabaseId: "sb-1",
  teamId: "team-1",
  profileId: "profile-1",
  profileEmail: "manager@test.com",
  profileName: "Manager",
  isMaster: true,
  managerId: "profile-1",
  canCreateAccountUsers: true,
  canManageAccountTeams: true,
  canTransferAccountLeads: true,
  canViewAllTeams: true,
  userTimezone: "America/Sao_Paulo",
  teamMember: { role: "manager", functions: [] },
}

describe("EmailCreditUseCase.subscribe (T01)", () => {
  beforeEach(() => {
    subscriptionFindUniqueMock.mockClear()
    createCheckoutMock.mockClear()
    resolveEmailBetaAccessMock.mockImplementation(async () => false)
    subscriptionFindUniqueMock.mockImplementation(async () => null)
    createCheckoutMock.mockImplementation(async (input?: CreateCheckoutArg) =>
      new Output(true, ["Checkout criado"], [], {
        checkoutId: "purchase-1",
        purchaseId: "purchase-1",
        checkoutUrl: "https://app.test/addon-checkout/purchase-1",
        externalReference: "platform-purchase-purchase-1",
        status: "pending",
        purchaseType: input?.purchaseType ?? "email_credits",
        productSlug: input?.productSlug ?? "email-credits-starter",
        teamId: input?.teamId ?? null,
        profileId: "profile-1",
        amount: input?.amount ?? 25,
        metadata: input?.metadata ?? {},
      })
    )
  })

  it("T01 — Manager compra Starter: cria PlatformPurchase checkout e NÃO cria assinatura ativa", async () => {
    const fakeCheckout = {
      createCheckout: createCheckoutMock,
    } as unknown as PlatformCheckoutUseCase

    const uc = new EmailCreditUseCase(
      { getStatus: getStatusMock } as never,
      fakeCheckout
    )

    const output = await uc.subscribe(EmailCreditPlan.starter, teamCtx, "PIX")

    expect(output.isValid).toBe(true)
    expect(createCheckoutMock).toHaveBeenCalledTimes(1)
    const checkoutInput = (createCheckoutMock.mock.calls[0] as unknown as [
      {
        purchaseType: string
        productSlug: string
        teamId: string
        billingType: string
        amount: number
        metadata: { plan: string }
      }
    ])[0]
    expect(checkoutInput.purchaseType).toBe("email_credits")
    expect(checkoutInput.productSlug).toBe("email-credits-starter")
    expect(checkoutInput.teamId).toBe("team-1")
    expect(checkoutInput.billingType).toBe("PIX")
    expect(checkoutInput.amount).toBe(25)
    expect(checkoutInput.metadata.plan).toBe("starter")

    expect(output.result.subscriptionActivated).toBe(false)
    expect(output.result.status).toBe("pending")
    expect(output.result.externalReference).toBe("platform-purchase-purchase-1")
    expect(output.result.checkoutUrl).toContain("/addon-checkout/")
    expect(output.result.pricePerMonth).toBe(25)
    expect(output.result.monthlyCredits).toBe(1000)
  })

  it("T01b — precificação canônica Business = R$650 / 50.000", async () => {
    const fakeCheckout = {
      createCheckout: createCheckoutMock,
    } as unknown as PlatformCheckoutUseCase

    const uc = new EmailCreditUseCase(
      { getStatus: getStatusMock } as never,
      fakeCheckout
    )

    const output = await uc.subscribe(EmailCreditPlan.business, teamCtx, "CREDIT_CARD")
    expect(output.isValid).toBe(true)
    expect(output.result.pricePerMonth).toBe(650)
    expect(output.result.monthlyCredits).toBe(50_000)
    const checkoutInput = (createCheckoutMock.mock.calls[0] as unknown as [
      { amount: number; metadata: { plan: string } }
    ])[0]
    expect(checkoutInput.amount).toBe(650)
    expect(checkoutInput.metadata.plan).toBe("business")
  })
})
