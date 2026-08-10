import { formatLocalDateValue, getMinutesInTz } from "@/lib/dates"

export type DispatchBlockedDateEntry = { date?: string; from?: string; to?: string }

export const RESEND_DOMAIN_TRACKING_DEGRADED_WARNING =
  "Tracking de abertura/clique indisponível neste domínio (CNAME pendente)."

/**
 * Statuses that allow campaign dispatch with a custom Resend domain.
 * `partially_verified` / `partially_failed` mean sending DNS (DKIM/SPF) is ok
 * while tracking may be pending or degraded — Resend still accepts sends.
 */
export function isResendDomainSendCapable(status: string | null | undefined): boolean {
  return (
    status === "verified" ||
    status === "partially_verified" ||
    status === "partially_failed"
  )
}

/** Full tracking (open/click) only when every DNS record including CNAME is verified. */
export function isResendDomainTrackingCapable(status: string | null | undefined): boolean {
  return status === "verified"
}

/** Non-blocking warnings when the team can send but open/click tracking is not fully verified. */
export function getResendDomainDispatchWarnings(
  status: string | null | undefined
): string[] {
  if (isResendDomainSendCapable(status) && !isResendDomainTrackingCapable(status)) {
    return [RESEND_DOMAIN_TRACKING_DEGRADED_WARNING]
  }
  return []
}

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
export function resolveCampaignStatusAfterDispatch(
  sentCount: number,
  failureDetail?: string | null
): {
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
    errorMessage: failureDetail?.trim() || "Nenhum e-mail foi enviado pelo provedor",
  }
}
