import { prisma } from "@/app/api/infra/data/prisma"
import {
  EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY,
  EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB,
} from "@/lib/email/campaign-limits"

export type TeamEmailCampaignLimits = {
  maxEmailsPerDay: number | null
  maxRecipientsPerSub: number | null
  isUnlimited: boolean
}

const DEFAULT_LIMITS: TeamEmailCampaignLimits = {
  maxEmailsPerDay: EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY,
  maxRecipientsPerSub: EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB,
  isUnlimited: false,
}

const UNLIMITED_LIMITS: TeamEmailCampaignLimits = {
  maxEmailsPerDay: null,
  maxRecipientsPerSub: null,
  isUnlimited: true,
}

export async function resolveTeamEmailCampaignLimits(
  teamId: string
): Promise<TeamEmailCampaignLimits> {
  const grant = await prisma.backofficeTeamEmailLimitGrant.findUnique({
    where: { teamId },
    select: { isActive: true, maxEmailsPerDay: true },
  })

  if (!grant?.isActive) {
    return DEFAULT_LIMITS
  }

  if (grant.maxEmailsPerDay == null) {
    return UNLIMITED_LIMITS
  }

  return {
    maxEmailsPerDay: grant.maxEmailsPerDay,
    maxRecipientsPerSub: grant.maxEmailsPerDay,
    isUnlimited: false,
  }
}
