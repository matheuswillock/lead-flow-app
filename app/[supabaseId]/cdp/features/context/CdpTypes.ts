export type CdpConsentStatus = "allowed" | "blocked" | "unknown"

export type CdpProfileListItem = {
  id: string
  displayName: string
  displayPhone: string
  primaryEmail: string | null
  lastSeenAt: string | null
  primarySegment?: string | null
  primarySegmentName?: string | null
  consents: Array<{ channel: string; status: CdpConsentStatus; reason: string | null }>
  sourceLinks: Array<{ sourceType: string }>
}

export type CdpSegment = {
  slug: string
  name: string
  description: string
  count: number
}

export type CdpMetrics = {
  totalProfiles: number
  marketable: number
  blocked: number
  engaged: number
}

export type CdpProfileDetail = CdpProfileListItem & {
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
    status: CdpConsentStatus
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

export type CdpSyncResult = {
  created: number
  enriched: number
  skipped: number
  errors: string[]
}
