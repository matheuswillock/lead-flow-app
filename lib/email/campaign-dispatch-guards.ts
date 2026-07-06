import { formatLocalDateValue, getMinutesInTz } from "@/lib/dates"

export type DispatchBlockedDateEntry = { date?: string; from?: string; to?: string }

export type DispatchWindowCheckResult =
  | { blocked: false }
  | { blocked: true; reason: string; defer: boolean }

/** Verifica datas bloqueadas e janela de horário no fuso do master. */
export function checkDispatchWindow(
  now: Date,
  timezone: string,
  options: {
    dispatchBlockedDates?: DispatchBlockedDateEntry[] | null
    dispatchTimeFrom?: string | null
    dispatchTimeTo?: string | null
  }
): DispatchWindowCheckResult {
  const todayStr = formatLocalDateValue(now, timezone)
  const blockedDates = options.dispatchBlockedDates ?? []

  for (const entry of blockedDates) {
    if (entry.date && entry.date === todayStr) {
      return {
        blocked: true,
        defer: true,
        reason: `Data ${todayStr} bloqueada por restrição configurada`,
      }
    }
    if (entry.from && entry.to && todayStr >= entry.from && todayStr <= entry.to) {
      return {
        blocked: true,
        defer: true,
        reason: `Período bloqueado ${entry.from} – ${entry.to}`,
      }
    }
  }

  const { dispatchTimeFrom, dispatchTimeTo } = options
  if (dispatchTimeFrom && dispatchTimeTo) {
    const currentMinutes = getMinutesInTz(now, timezone)
    const [fH, fM] = dispatchTimeFrom.split(":").map(Number)
    const [tH, tM] = dispatchTimeTo.split(":").map(Number)
    const fromMinutes = fH * 60 + fM
    const toMinutes = tH * 60 + tM
    if (currentMinutes < fromMinutes || currentMinutes > toMinutes) {
      return {
        blocked: true,
        defer: true,
        reason: `Fora da janela de disparo ${dispatchTimeFrom}–${dispatchTimeTo} (${timezone})`,
      }
    }
  }

  return { blocked: false }
}

/** Campanha só é considerada enviada com sucesso se ao menos um e-mail saiu. */
export function resolveCampaignStatusAfterDispatch(sentCount: number): {
  campaignStatus: "sent" | "failed"
  dispatchStatus: "completed" | "failed"
  errorMessage: string | null
} {
  if (sentCount > 0) {
    return { campaignStatus: "sent", dispatchStatus: "completed", errorMessage: null }
  }
  return {
    campaignStatus: "failed",
    dispatchStatus: "failed",
    errorMessage: "Nenhum e-mail foi enviado pelo provedor",
  }
}
