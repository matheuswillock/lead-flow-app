import { prisma } from "@/app/api/infra/data/prisma"
import { formatLocalDateValue } from "@/lib/dates"
import { EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY } from "@/lib/email/campaign-limits"

/**
 * Soma recipients de dispatches do time no dia civil (timezone) em status sending/completed.
 * Usado como teto diário antes de iniciar um novo disparo.
 */
export async function countTeamEmailsDispatchedOnCivilDay(params: {
  teamId: string
  timezone: string
  now: Date
  excludeCampaignId?: string
}): Promise<number> {
  const dayKey = formatLocalDateValue(params.now, params.timezone)

  const dispatches = await prisma.emailCampaignDispatch.findMany({
    where: {
      teamId: params.teamId,
      status: { in: ["sending", "completed"] },
      ...(params.excludeCampaignId ? { campaignId: { not: params.excludeCampaignId } } : {}),
    },
    select: {
      totalRecipients: true,
      totalSent: true,
      status: true,
      dispatchedAt: true,
    },
  })

  let total = 0
  for (const dispatch of dispatches) {
    if (formatLocalDateValue(dispatch.dispatchedAt, params.timezone) !== dayKey) continue
    total +=
      dispatch.status === "sending"
        ? dispatch.totalRecipients
        : Math.max(dispatch.totalSent, 0)
  }

  return total
}

export async function wouldExceedDailyEmailCap(params: {
  teamId: string
  timezone: string
  now: Date
  additionalRecipients: number
  excludeCampaignId?: string
  maxPerDay?: number
}): Promise<{ exceeded: boolean; used: number; limit: number }> {
  const limit = params.maxPerDay ?? EMAIL_CAMPAIGN_MAX_EMAILS_PER_DAY
  const used = await countTeamEmailsDispatchedOnCivilDay({
    teamId: params.teamId,
    timezone: params.timezone,
    now: params.now,
    excludeCampaignId: params.excludeCampaignId,
  })

  return {
    exceeded: used + params.additionalRecipients > limit,
    used,
    limit,
  }
}
