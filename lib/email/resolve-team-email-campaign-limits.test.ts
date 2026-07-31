import { describe, expect, it, mock } from "bun:test"
import {
  EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY,
  EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB,
  formatDailyLimitDispatchBlockMessage,
  formatDailyLimitFailureMessage,
  isDailyLimitErrorMessage,
} from "@/lib/email/campaign-limits"
import { resolveTeamEmailCampaignLimits } from "@/lib/email/resolve-team-email-campaign-limits"

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    backofficeTeamEmailLimitGrant: {
      findUnique: mock(async ({ where }: { where: { teamId: string } }) => {
        if (where.teamId === "unlimited-team") {
          return { isActive: true, maxEmailsPerDay: null }
        }
        if (where.teamId === "custom-team") {
          return { isActive: true, maxEmailsPerDay: 5000 }
        }
        if (where.teamId === "inactive-team") {
          return { isActive: false, maxEmailsPerDay: 10000 }
        }
        return null
      }),
    },
  },
}))

describe("resolveTeamEmailCampaignLimits", () => {
  it("returns defaults when no grant exists", async () => {
    const limits = await resolveTeamEmailCampaignLimits("default-team")
    expect(limits).toEqual({
      maxEmailsPerDay: EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY,
      maxRecipientsPerSub: EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB,
      isUnlimited: false,
    })
  })

  it("returns unlimited when grant has null maxEmailsPerDay", async () => {
    const limits = await resolveTeamEmailCampaignLimits("unlimited-team")
    expect(limits.isUnlimited).toBe(true)
    expect(limits.maxEmailsPerDay).toBeNull()
    expect(limits.maxRecipientsPerSub).toBeNull()
  })

  it("returns custom limit when grant is active", async () => {
    const limits = await resolveTeamEmailCampaignLimits("custom-team")
    expect(limits).toEqual({
      maxEmailsPerDay: 5000,
      maxRecipientsPerSub: 5000,
      isUnlimited: false,
    })
  })

  it("ignores inactive grants", async () => {
    const limits = await resolveTeamEmailCampaignLimits("inactive-team")
    expect(limits.maxEmailsPerDay).toBe(EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY)
  })
})

describe("campaign limit messages", () => {
  it("formats daily limit failure and block messages", () => {
    expect(formatDailyLimitFailureMessage(1800, 2000)).toContain("Limite diário de 2.000")
    expect(formatDailyLimitDispatchBlockMessage(2000, 200)).toContain("Restam 200")
  })

  it("detects daily limit error messages", () => {
    expect(isDailyLimitErrorMessage("Limite diário de 2.000 e-mails atingido")).toBe(true)
    expect(isDailyLimitErrorMessage("Erro interno durante o disparo")).toBe(false)
  })
})
