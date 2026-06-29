export type CdpSyncFilters = {
  leadId?: string
  updatedSince?: Date
  emailLogSince?: Date
}

export function parseCdpSyncFilters(body: unknown): CdpSyncFilters {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {}

  const record = body as Record<string, unknown>
  const filters: CdpSyncFilters = {}

  if (typeof record.leadId === "string" && record.leadId.trim()) {
    filters.leadId = record.leadId.trim()
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
