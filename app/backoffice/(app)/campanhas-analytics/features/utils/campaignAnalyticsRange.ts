import type { CampaignAnalyticsFiltersState } from "../context/CampanhasAnalyticsTypes"

// Mesmo limite do backend (lib/backoffice-campaign-analytics/dateRange.ts) — o
// bloqueio no cliente usa a MESMA mensagem para não divergir da resposta 400 real.
export const CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS = 92
export const CAMPAIGN_ANALYTICS_DEFAULT_RANGE_DAYS = 30

function toUtcDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Espelha as mensagens de `resolveCampaignAnalyticsDateRange` no backend. */
export function validateCampaignAnalyticsRange(from: string, to: string): string | null {
  if (!from || !to) return null

  const fromDate = toUtcDateOnly(from)
  const toDate = toUtcDateOnly(to)
  if (!fromDate || !toDate) return "Datas inválidas — use o formato AAAA-MM-DD."

  if (toDate.getTime() < fromDate.getTime()) {
    return "O fim do período não pode ser anterior ao início do período."
  }

  const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1
  if (dayCount > CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS) {
    return `O período não pode ultrapassar ${CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS} dias — selecione um intervalo menor.`
  }

  return null
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function buildDefaultCampaignAnalyticsFilters(today: Date = new Date()): CampaignAnalyticsFiltersState {
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const from = new Date(to.getTime() - (CAMPAIGN_ANALYTICS_DEFAULT_RANGE_DAYS - 1) * 86_400_000)
  return { from: formatDateOnly(from), to: formatDateOnly(to), teamIds: [] }
}

/** Chave estável de request — mesmos filtros (independente da ordem de teamIds) = mesma chave. */
export function buildCampaignAnalyticsRequestKey(filters: CampaignAnalyticsFiltersState): string {
  return `${filters.from}|${filters.to}|${[...filters.teamIds].sort().join(",")}`
}
