export type RadarConsentStatus = "allowed" | "blocked" | "unknown"

export type RadarProfileListItem = {
  id: string
  displayName: string
  displayPhone: string | null
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
  description: string | null
  count: number
  isSystem: boolean
}

/** Mirrors lib/radar/segment-dsl.ts's discriminated union — kept in sync manually. */
export type RadarProfileFieldCondition = {
  kind: "profile_field"
  field: "primaryEmail" | "primaryDocument" | "lastSeenAt"
  operator: "eq" | "neq" | "contains" | "is_empty" | "not_empty" | "before" | "after" | "within_days"
  value?: unknown
}

export type RadarConsentCondition = {
  kind: "consent"
  channel: "email" | "whatsapp"
  status: RadarConsentStatus
}

export type RadarEventCondition = {
  kind: "event"
  eventType: string
  occurrence: "occurred" | "not_occurred"
  windowDays?: number
}

export type RadarLeadCustomFieldCondition = {
  kind: "lead_custom_field"
  definitionId: string
  operator: "eq" | "neq" | "contains" | "is_empty" | "not_empty"
  value?: unknown
}

export type RadarLeadStatusCondition = {
  kind: "lead_status"
  statuses: string[]
}

export type RadarLeadFieldCondition = {
  kind: "lead_field"
  fieldKey:
    | "status"
    | "currentHealthPlan"
    | "currentValue"
    | "ticket"
    | "meetingDate"
    | "followUpAt"
    | "contractDueDate"
    | "soldPlan"
    | "isReferral"
    | "assignedTo"
    | "closerId"
  operator: string
  value?: unknown
}

export type RadarSegmentCondition =
  | RadarProfileFieldCondition
  | RadarConsentCondition
  | RadarEventCondition
  | RadarLeadCustomFieldCondition
  | RadarLeadStatusCondition
  | RadarLeadFieldCondition

export type RadarSegmentRules = {
  match: "all" | "any"
  conditions: RadarSegmentCondition[]
}

export type RadarCustomSegment = {
  id: string
  teamId: string
  createdBy: string
  name: string
  description: string | null
  rulesJson: RadarSegmentRules
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** `GET .../segments/custom` includes `count`; create/update responses don't. */
export type RadarCustomSegmentListItem = RadarCustomSegment & { count: number }

export type RadarSegmentDeleteResult = {
  id: string
  softDeleted: boolean
}

export type RadarMetrics = {
  totalProfiles: number
  marketable: number
  blocked: number
  engaged: number
}

export type RadarProfileDetail = RadarProfileListItem & {
  normalizedName: string
  normalizedPhone: string | null
  primaryDocument: string | null
  profileData?: Record<string, unknown> | null
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
