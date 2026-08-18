export const BACKOFFICE_LEAD_EXTRACTION_STATUS_ATIVA = "2"

export const BACKOFFICE_LEAD_EXTRACTION_LIMIT_MIN = 1
export const BACKOFFICE_LEAD_EXTRACTION_LIMIT_MAX = 1000
export const BACKOFFICE_LEAD_EXTRACTION_LIMIT_DEFAULT = 100

export function clampLeadExtractionLimit(limit: unknown): number {
  const n = typeof limit === "number" ? limit : Number(limit)
  if (!Number.isFinite(n)) {
    return BACKOFFICE_LEAD_EXTRACTION_LIMIT_DEFAULT
  }
  return Math.min(
    BACKOFFICE_LEAD_EXTRACTION_LIMIT_MAX,
    Math.max(BACKOFFICE_LEAD_EXTRACTION_LIMIT_MIN, Math.trunc(n))
  )
}
