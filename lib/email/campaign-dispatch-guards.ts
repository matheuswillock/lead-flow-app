import { formatLocalDateValue, getMinutesInTz } from "@/lib/dates"

export type DispatchBlockedDateEntry = { date?: string; from?: string; to?: string }

export const RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE =
  "Com domínio próprio, é obrigatório habilitar as métricas de abertura e clique. Nenhum disparo será liberado até que as métricas estejam ativas e o DNS de tracking esteja verificado."

/** @deprecated Use RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE — same copy after tracking became a hard gate. */
export const RESEND_DOMAIN_TRACKING_DEGRADED_WARNING = RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE

export type ResendDomainTrackingInput = {
  domainName?: string | null
  domainStatus?: string | null
  openTracking?: boolean | null
  clickTracking?: boolean | null
}

export type ResendDomainTrackingCheck =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Statuses that allow campaign dispatch with a custom Resend domain.
 * `partially_verified` / `partially_failed` mean sending DNS (DKIM/SPF) is ok
 * while tracking may be pending or degraded — Resend still accepts sends.
 * Campaign dispatch additionally requires `assertResendDomainTrackingReady`.
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

export function resendDomainTrackingInputFromSettings(settings: {
  resendDomainName?: string | null
  resendDomainStatus?: string | null
  resendOpenTracking?: boolean | null
  resendClickTracking?: boolean | null
} | null | undefined): ResendDomainTrackingInput {
  return {
    domainName: settings?.resendDomainName,
    domainStatus: settings?.resendDomainStatus,
    openTracking: settings?.resendOpenTracking,
    clickTracking: settings?.resendClickTracking,
  }
}

/**
 * Custom domains must have at least one tracking metric enabled and a fully
 * verified Resend status (CNAME included) before campaign dispatch.
 * Teams without a custom domain are not gated.
 */
export function assertResendDomainTrackingReady(
  params: ResendDomainTrackingInput
): ResendDomainTrackingCheck {
  if (!params.domainName?.trim()) return { ok: true }

  const metricsEnabled = Boolean(params.openTracking || params.clickTracking)
  if (!metricsEnabled || !isResendDomainTrackingCapable(params.domainStatus)) {
    return { ok: false, message: RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE }
  }
  return { ok: true }
}

/** Warnings when campaign dispatch is blocked by the tracking gate. */
export function getResendDomainDispatchWarnings(params: ResendDomainTrackingInput): string[] {
  const result = assertResendDomainTrackingReady(params)
  return result.ok ? [] : [result.message]
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

/** Campanha só é `sent` quando todos os destinatários saíram; parcial fica `partially_sent`. */
export function resolveCampaignStatusAfterDispatch(
  sentCount: number,
  failureDetail?: string | null,
  totalRecipients?: number
): {
  campaignStatus: "sent" | "failed" | "partially_sent"
  dispatchStatus: "completed" | "failed"
  errorMessage: string | null
} {
  if (sentCount <= 0) {
    return {
      campaignStatus: "failed",
      dispatchStatus: "failed",
      errorMessage: failureDetail?.trim() || "Nenhum e-mail foi enviado pelo provedor",
    }
  }

  const hasUnsentRecipients =
    typeof totalRecipients === "number" && totalRecipients > sentCount
  if (hasUnsentRecipients) {
    return {
      campaignStatus: "partially_sent",
      dispatchStatus: "completed",
      errorMessage: failureDetail?.trim() || null,
    }
  }

  return { campaignStatus: "sent", dispatchStatus: "completed", errorMessage: null }
}
