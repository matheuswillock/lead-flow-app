export type RadarSyncFilters = {
  leadId?: string
  leadIds?: string[]
  portfolioId?: string
  emailContactId?: string
  finalizedId?: string
  updatedSince?: Date
  emailLogSince?: Date
}

export function parseRadarSyncFilters(body: unknown): RadarSyncFilters {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {}

  const record = body as Record<string, unknown>
  const filters: RadarSyncFilters = {}

  if (typeof record.leadId === "string" && record.leadId.trim()) {
    filters.leadId = record.leadId.trim()
  }

  if (Array.isArray(record.leadIds)) {
    const leadIds = record.leadIds
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim())
    if (leadIds.length > 0) filters.leadIds = [...new Set(leadIds)]
  }

  if (typeof record.portfolioId === "string" && record.portfolioId.trim()) {
    filters.portfolioId = record.portfolioId.trim()
  }

  if (typeof record.emailContactId === "string" && record.emailContactId.trim()) {
    filters.emailContactId = record.emailContactId.trim()
  }

  if (typeof record.finalizedId === "string" && record.finalizedId.trim()) {
    filters.finalizedId = record.finalizedId.trim()
  }

  if (typeof record.updatedSince === "string" && record.updatedSince.trim()) {
    const parsed = new Date(record.updatedSince)
    if (!Number.isNaN(parsed.getTime())) filters.updatedSince = parsed
  }

  if (typeof record.emailLogSince === "string" && record.emailLogSince.trim()) {
    const parsed = new Date(record.emailLogSince)
    if (!Number.isNaN(parsed.getTime())) filters.emailLogSince = parsed
  }

  return filters
}
