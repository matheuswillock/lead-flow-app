import type { CreditStatus } from "../context/CampanhasTypes"
import { formatDailyLimitDispatchBlockMessage } from "@/lib/email/campaign-limits"

type CampaignRecipientTarget = {
  totalRecipients: number
}

function resolveDailyDispatchBlockReason(
  campaign: CampaignRecipientTarget,
  credits: CreditStatus | null
): string | undefined {
  const dailyDispatch = credits?.dailyDispatch
  if (
    dailyDispatch &&
    !dailyDispatch.isUnlimited &&
    dailyDispatch.limit != null &&
    dailyDispatch.remaining != null &&
    dailyDispatch.remaining < campaign.totalRecipients
  ) {
    return formatDailyLimitDispatchBlockMessage(dailyDispatch.limit, dailyDispatch.remaining)
  }

  return undefined
}

export function getCampaignSendBlockReason(params: {
  campaign: CampaignRecipientTarget
  credits: CreditStatus | null
  isCampaignsBetaAccess: boolean
}): string | undefined {
  const { campaign, credits, isCampaignsBetaAccess } = params

  const dailyBlockReason = resolveDailyDispatchBlockReason(campaign, credits)
  if (dailyBlockReason) return dailyBlockReason

  if (isCampaignsBetaAccess || credits?.isBetaExempt) return undefined
  if (!credits?.hasSubscription) {
    return "Ative um plano em Assinaturas para disparar campanhas"
  }
  if (credits.creditsAvailable < campaign.totalRecipients) {
    return `Créditos insuficientes para ${campaign.totalRecipients.toLocaleString("pt-BR")} destinatários. Saldo: ${credits.creditsAvailable.toLocaleString("pt-BR")}`
  }

  return undefined
}
