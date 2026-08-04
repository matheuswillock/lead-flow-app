import { describe, expect, it } from "bun:test"
import { getCampaignSendBlockReason } from "./getCampaignSendBlockReason"
import type { CreditStatus } from "../context/CampanhasTypes"

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
      isCampaignsBetaAccess: false,
    })

    expect(reason).toContain("Restam 100")
  })

  it("skips subscription and credit checks for beta-exempt teams when daily cap allows send", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({ isBetaExempt: true, hasSubscription: false, creditsAvailable: 0 }),
      isCampaignsBetaAccess: false,
    })

    expect(reason).toBeUndefined()
  })

  it("skips subscription check when campaigns feature is in beta (D8)", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({ hasSubscription: false, isBetaExempt: false, creditsAvailable: 0 }),
      isCampaignsBetaAccess: true,
    })

    expect(reason).toBeUndefined()
  })

  it("blocks without subscription when not beta and not exempt", () => {
    const reason = getCampaignSendBlockReason({
      campaign: { totalRecipients: 50 },
      credits: makeCredits({
        hasSubscription: false,
        isBetaExempt: false,
        creditsAvailable: 0,
        dailyDispatch: { limit: null, used: 0, remaining: null, isUnlimited: true },
      }),
      isCampaignsBetaAccess: false,
    })

    expect(reason).toBe("Ative um plano em Assinaturas para disparar campanhas")
  })
})
