import { buildRates, safeRate } from "@/lib/email/analytics-rates"

/** Volume mínimo de envios para entrar no ranking (evita taxa 100% com amostra ínfima). */
export const CAMPAIGN_RANKING_MIN_SENT = 10

export type CampaignTotalsInput = {
  campaignId: string
  name: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
}

export type RankedCampaign = CampaignTotalsInput & {
  rates: ReturnType<typeof buildRates>
  rank: number
}

function hasEnoughData(row: CampaignTotalsInput): boolean {
  return row.sent >= CAMPAIGN_RANKING_MIN_SENT
}

function compareByOpenRate(a: CampaignTotalsInput, b: CampaignTotalsInput): number {
  const rateDiff = safeRate(b.opened, b.sent) - safeRate(a.opened, a.sent)
  if (rateDiff !== 0) return rateDiff
  const absDiff = b.opened - a.opened
  if (absDiff !== 0) return absDiff
  return a.name.localeCompare(b.name, "pt-BR")
}

/**
 * Rankeia as melhores campanhas por taxa de abertura.
 * Empate: maior volume absoluto de aberturas, depois nome.
 * Sem dados suficientes (sent < MIN): excluído do ranking.
 */
export function rankTopCampaigns(rows: CampaignTotalsInput[], limit = 3): RankedCampaign[] {
  return [...rows]
    .filter(hasEnoughData)
    .sort(compareByOpenRate)
    .slice(0, limit)
    .map((row, index) => ({
      ...row,
      rates: buildRates(row),
      rank: index + 1,
    }))
}

/** Agrega linhas brutas (ex.: por disparo) por campaignId antes do ranking. */
export function aggregateCampaignTotals(
  rows: Array<{
    campaignId: string
    name: string
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
  }>,
): CampaignTotalsInput[] {
  const map = new Map<string, CampaignTotalsInput>()

  for (const row of rows) {
    const existing = map.get(row.campaignId)
    if (!existing) {
      map.set(row.campaignId, { ...row })
      continue
    }
    existing.sent += row.sent
    existing.delivered += row.delivered
    existing.opened += row.opened
    existing.clicked += row.clicked
    existing.bounced += row.bounced
    existing.complained += row.complained
    existing.name = row.name
  }

  return Array.from(map.values())
}
