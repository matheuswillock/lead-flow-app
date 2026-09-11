export const CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS = 92

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export type CampaignAnalyticsDateRange = {
  from: Date
  to: Date
}

export type CampaignAnalyticsDateRangeResult =
  | { ok: true; value: CampaignAnalyticsDateRange }
  | { ok: false; error: string }

function parseUtcDateOnly(value: string): Date | null {
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  // `Date.UTC`/o parser de string ISO rolam datas de calendário inexistentes
  // para o próximo mês em vez de rejeitar (ex.: 2026-02-31 -> 2026-03-03).
  // Conferir o round-trip dos componentes é a única forma de pegar isso.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }

  return date
}

// DA5 (SPEC 10): from/to obrigatórios (ISO date), dia fechado em UTC
// [from 00:00, to+1 00:00), range <= CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS dias.
export function resolveCampaignAnalyticsDateRange(input: {
  from: string | null
  to: string | null
}): CampaignAnalyticsDateRangeResult {
  if (!input.from || !input.to) {
    return { ok: false, error: "Parâmetros \"from\" e \"to\" são obrigatórios (formato AAAA-MM-DD)." }
  }

  const fromDate = parseUtcDateOnly(input.from)
  const toDate = parseUtcDateOnly(input.to)

  if (!fromDate || !toDate) {
    return { ok: false, error: "Datas inválidas — use o formato AAAA-MM-DD." }
  }

  if (toDate.getTime() < fromDate.getTime()) {
    return { ok: false, error: "O fim do período não pode ser anterior ao início do período." }
  }

  const exclusiveTo = new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
  const dayCount = Math.round((exclusiveTo.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000))

  if (dayCount > CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: `O período não pode ultrapassar ${CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS} dias — selecione um intervalo menor.`,
    }
  }

  return { ok: true, value: { from: fromDate, to: exclusiveTo } }
}
