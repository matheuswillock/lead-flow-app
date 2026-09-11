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

// Dia civil LOCAL (não UTC) — precisa bater com o "hoje" que o FiltersBar usa
// no calendário/presets (react-day-picker exibe e seleciona em hora local).
// Achado do Cursor review no PR #1126: usar UTC aqui e local no FiltersBar
// diverge à noite em fusos atrás de UTC (ex.: America/Sao_Paulo) — o UTC já
// virou o dia seguinte enquanto o picker ainda mostra "hoje" como local.
function formatDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function subtractLocalCalendarDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - days)
}

export function buildDefaultCampaignAnalyticsFilters(now: Date = new Date()): CampaignAnalyticsFiltersState {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const from = subtractLocalCalendarDays(to, CAMPAIGN_ANALYTICS_DEFAULT_RANGE_DAYS - 1)
  return { from: formatDateOnly(from), to: formatDateOnly(to), teamIds: [] }
}

/** Chave estável de request — mesmos filtros (independente da ordem de teamIds) = mesma chave. */
export function buildCampaignAnalyticsRequestKey(filters: CampaignAnalyticsFiltersState): string {
  return `${filters.from}|${filters.to}|${[...filters.teamIds].sort().join(",")}`
}
