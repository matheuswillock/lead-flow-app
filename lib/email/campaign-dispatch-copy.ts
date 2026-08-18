/**
 * Copy e classificação do disparo manual (lista, ficha e toast).
 *
 * Retry de falhas só quando alguém já recebeu (`totalSent > 0`). Campanha
 * `failed`/`partially_sent` com zero enviados é o primeiro Disparar.
 */

export const CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE =
  "Ocorreu um erro ao disparar a campanha"

/** Constante INTERNAL antiga persistida em campanhas já falhas. */
const LEGACY_INTERNAL_ERROR_MESSAGE = "Erro interno durante o disparo"

/** HTTP 400 ainda mapeia INTERNAL para esta frase curta. */
const HTTP_INTERNAL_ERROR_MESSAGE = "Erro ao disparar campanha"

export function isCampaignFailedRetry(campaign: {
  status: string
  totalSent?: number | null
}): boolean {
  const totalSent = campaign.totalSent ?? 0
  return (
    (campaign.status === "failed" || campaign.status === "partially_sent") &&
    totalSent > 0
  )
}

export function campaignDispatchSendOptions(campaign: {
  status: string
  totalSent?: number | null
}): { retryFailedOnly: true } | undefined {
  return isCampaignFailedRetry(campaign) ? { retryFailedOnly: true } : undefined
}

export function formatCampaignDispatchErrorMessage(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed) return raw

  if (
    trimmed === CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE ||
    trimmed === LEGACY_INTERNAL_ERROR_MESSAGE ||
    trimmed === HTTP_INTERNAL_ERROR_MESSAGE ||
    trimmed.includes("Erro interno")
  ) {
    return CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE
  }

  return raw
}
