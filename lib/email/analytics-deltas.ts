import type { buildRates } from "@/lib/email/analytics-rates"

export type MetricDeltaDirection = "up" | "down" | "neutral"

export type MetricDelta = {
  direction: MetricDeltaDirection
  /** Diferença absoluta (pp para taxas, unidades para contagens). */
  absolute: number
  /** Variação percentual relativa ao previous; null quando previous === 0. */
  percent: number | null
}

export type AnalyticsRates = ReturnType<typeof buildRates>

export type AnalyticsTotalsForDelta = {
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  failed: number
  deliveryDelayed: number
  unsubscribed: number
  suppressed: number
  formCompletions: number
  formViewed: number
  formStarted: number
}

/** Neutro para taxas quando |diff| < 0.05 pp. */
const RATE_NEUTRAL_THRESHOLD = 0.05

export function calcMetricDelta(
  current: number,
  previous: number,
  options?: { isRate?: boolean },
): MetricDelta {
  const absolute = Math.round((current - previous) * 100) / 100
  const percent =
    previous === 0 ? (current === 0 ? 0 : null) : Math.round(((current - previous) / previous) * 10000) / 100

  if (options?.isRate) {
    if (Math.abs(absolute) < RATE_NEUTRAL_THRESHOLD) {
      return { direction: "neutral", absolute: 0, percent: percent === null ? null : 0 }
    }
  } else if (absolute === 0) {
    return { direction: "neutral", absolute: 0, percent: percent === null ? null : 0 }
  }

  if (absolute > 0) return { direction: "up", absolute, percent }
  if (absolute < 0) return { direction: "down", absolute, percent }
  return { direction: "neutral", absolute: 0, percent: percent === null ? null : 0 }
}

export function attachRateDeltas(
  current: AnalyticsRates,
  previous: AnalyticsRates,
): Record<keyof AnalyticsRates, MetricDelta> {
  return {
    deliverabilityRate: calcMetricDelta(current.deliverabilityRate, previous.deliverabilityRate, {
      isRate: true,
    }),
    openRate: calcMetricDelta(current.openRate, previous.openRate, { isRate: true }),
    clickRate: calcMetricDelta(current.clickRate, previous.clickRate, { isRate: true }),
    bounceRate: calcMetricDelta(current.bounceRate, previous.bounceRate, { isRate: true }),
    complainRate: calcMetricDelta(current.complainRate, previous.complainRate, { isRate: true }),
  }
}

export function attachTotalDeltas(
  current: AnalyticsTotalsForDelta,
  previous: AnalyticsTotalsForDelta,
): Record<keyof AnalyticsTotalsForDelta, MetricDelta> {
  return {
    sent: calcMetricDelta(current.sent, previous.sent),
    delivered: calcMetricDelta(current.delivered, previous.delivered),
    opened: calcMetricDelta(current.opened, previous.opened),
    clicked: calcMetricDelta(current.clicked, previous.clicked),
    bounced: calcMetricDelta(current.bounced, previous.bounced),
    complained: calcMetricDelta(current.complained, previous.complained),
    failed: calcMetricDelta(current.failed, previous.failed),
    deliveryDelayed: calcMetricDelta(current.deliveryDelayed, previous.deliveryDelayed),
    unsubscribed: calcMetricDelta(current.unsubscribed, previous.unsubscribed),
    suppressed: calcMetricDelta(current.suppressed, previous.suppressed),
    formCompletions: calcMetricDelta(current.formCompletions, previous.formCompletions),
    formViewed: calcMetricDelta(current.formViewed, previous.formViewed),
    formStarted: calcMetricDelta(current.formStarted, previous.formStarted),
  }
}

/** Período imediatamente anterior com a mesma duração. */
export function previousPeriodRange(from: Date, to: Date): { from: Date; to: Date } {
  const durationMs = Math.max(0, to.getTime() - from.getTime())
  return {
    from: new Date(from.getTime() - durationMs),
    to: new Date(from.getTime()),
  }
}
