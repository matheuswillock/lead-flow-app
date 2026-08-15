import { describe, expect, it } from "bun:test"
import { getCampaignSendBlockReason } from "./getCampaignSendBlockReason"
import type { CreditStatus } from "../context/CampanhasTypes"
import { RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE } from "@/lib/email/campaign-dispatch-guards"

function makeCredits(overrides: Partial<CreditStatus> = {}): CreditStatus {
  return {
    hasSubscription: true,
    isBetaExempt: false,
    plan: "starter",
    monthlyCredits: 1000,
    creditsUsed: 0,
    creditsAvailable: 1000,
    currentPeriodEnd: null,
    dailyDispatch: {
      limit: 2000,
      used: 1900,
      remaining: 100,
      isUnlimited: false,
    },
    ...overrides,
  }
}

describe("getCampaignSendBlockReason", () => {
  it("blocks beta-exempt teams when daily cap is insufficient", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 500 },
      credits: makeCredits({ isBetaExempt: true, hasSubscription: false }),
    })

    expect(reason).toContain("Restam 100")
  })

  it("skips subscription and credit checks when credits.isBetaExempt matches backend", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({ isBetaExempt: true, hasSubscription: false, creditsAvailable: 0 }),
    })

    expect(reason).toBeUndefined()
  })

  it("skips subscription check when runtime bypassPlanGate is set", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({ hasSubscription: false, isBetaExempt: false, creditsAvailable: 0 }),
      bypassPlanGate: true,
    })

    expect(reason).toBeUndefined()
  })

  it("does not treat display beta label alone — requires isBetaExempt or bypass", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({
        hasSubscription: false,
        isBetaExempt: false,
        creditsAvailable: 0,
        dailyDispatch: { limit: null, used: 0, remaining: null, isUnlimited: true },
      }),
    })

    expect(reason).toBe("Ative um plano em Assinaturas para disparar campanhas")
  })

  it("blocks without subscription when not beta-exempt and not bypassed", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({
        hasSubscription: false,
        isBetaExempt: false,
        creditsAvailable: 0,
        dailyDispatch: { limit: null, used: 0, remaining: null, isUnlimited: true },
      }),
      bypassPlanGate: false,
    })

    expect(reason).toBe("Ative um plano em Assinaturas para disparar campanhas")
  })

  it("blocks when custom-domain tracking is not ready", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({
        trackingDispatchBlocked: true,
        trackingDispatchBlockReason: RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE,
      }),
    })

    expect(reason).toBe(RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE)
  })

  it("uses tracking required copy when blocked without a reason payload", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({ trackingDispatchBlocked: true }),
    })

    expect(reason).toBe(RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE)
  })
})
