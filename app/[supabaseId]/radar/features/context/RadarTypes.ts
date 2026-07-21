export type RadarConsentStatus = "allowed" | "blocked" | "unknown"

export type RadarProfileListItem = {
  id: string
  displayName: string
  displayPhone: string
  primaryEmail: string | null
  lastSeenAt: string | null
  primarySegment?: string | null
  primarySegmentName?: string | null
  consents: Array<{ channel: string; status: RadarConsentStatus; reason: string | null }>
  sourceLinks: Array<{ sourceType: string }>
}

export type RadarSegment = {
  slug: string
  name: string
  description: string
  count: number
}

export type RadarMetrics = {
  totalProfiles: number
  marketable: number
  blocked: number
  engaged: number
}

export type RadarProfileDetail = RadarProfileListItem & {
  normalizedName: string
  normalizedPhone: string
  primaryDocument: string | null
  identities: Array<{
    id: string
    type: string
    value: string | null
    normalizedValue: string
    source: string
    isPrimary: boolean
  }>
  sourceLinks: Array<{
    id: string
    sourceType: string
    sourceId: string
    lastSyncedAt: string
    sourceMetadata: unknown
  }>
  consents: Array<{
    id: string
    channel: string
    status: RadarConsentStatus
    reason: string | null
    sourceType: string | null
    updatedAt: string
  }>
  events: Array<{
    id: string
    eventType: string
    sourceType: string
    occurredAt: string
    metadata: unknown
  }>
}

export type RadarSyncResult = {
  created: number
  enriched: number
  skipped: number
  errors: string[]
}
