export type LandingAttribution = {
  campaignId?: string
  emailLogId?: string
  source?: string
  medium?: string
  campaign?: string
  referrer?: string
}

const MAX_VALUE_LENGTH = 200

function normalizeValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  if (!normalized || normalized.length > MAX_VALUE_LENGTH || /[\r\n]/.test(normalized)) return undefined
  return normalized
}

function normalizeReferrer(value: unknown): string | undefined {
  const normalized = normalizeValue(value)
  if (!normalized) return undefined
  try {
    const url = new URL(normalized)
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin + url.pathname : undefined
  } catch {
    return undefined
  }
}

export function normalizeLandingAttribution(input: Record<string, unknown>): LandingAttribution {
  return {
    campaignId: normalizeValue(input.campaign_id),
    emailLogId: normalizeValue(input.cs_el),
    source: normalizeValue(input.utm_source),
    medium: normalizeValue(input.utm_medium),
    campaign: normalizeValue(input.utm_campaign),
    referrer: normalizeReferrer(input.referrer),
  }
}
