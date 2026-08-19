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

/**
 * `maxEmailsPerDay: null` no grant significa "sem teto diário de envio" — não
 * "sem teto de destinatários por sub-campanha". Um grant ilimitado ainda deve
 * quebrar campanhas grandes em sub-campanhas de `EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB`,
 * senão a campanha inteira vira um único disparo não-chunked (causa raiz do
 * incidente de timeout em campanhas de dezenas de milhares de destinatários).
 */
const UNLIMITED_DAILY_LIMITS: TeamEmailCampaignLimits = {
  maxEmailsPerDay: null,
  maxRecipientsPerSub: EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB,
  isUnlimited: true,
}

export async function resolveTeamEmailCampaignLimits(
  teamId: string
): Promise<TeamEmailCampaignLimits> {
  const grant = await prisma.teamEmailCampaignLimitGrant.findUnique({
    where: { teamId },
    select: { isActive: true, maxEmailsPerDay: true },
  })

  if (!grant?.isActive) {
    return DEFAULT_LIMITS
  }

  if (grant.maxEmailsPerDay == null) {
    return UNLIMITED_DAILY_LIMITS
  }

  return {
    maxEmailsPerDay: grant.maxEmailsPerDay,
    maxRecipientsPerSub: grant.maxEmailsPerDay,
    isUnlimited: false,
  }
}
