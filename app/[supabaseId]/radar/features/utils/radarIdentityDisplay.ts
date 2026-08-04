/** Tipos de identidade com valor legível para humanos (não UUID interno). */
const DISPLAYABLE_IDENTITY_TYPES = new Set([
  "phone",
  "email",
  "document",
  "lead_id",
])

/** Tipos internos cujo valor é tipicamente um UUID cru — ocultos na UI. */
const INTERNAL_IDENTITY_TYPES = new Set([
  "email_contact_id",
  "portfolio_id",
  "whatsapp_contact_id",
  "visitor_session",
])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type RadarIdentityLike = {
  type: string
  value: string | null
  normalizedValue: string
}

export function isRawUuid(value: string | null | undefined): boolean {
  if (!value) return false
  return UUID_RE.test(value.trim())
}

/** Identidades de tipos internos (ou UUID cru sem rótulo claro) não entram na lista. */
export function isDisplayableRadarIdentity(identity: RadarIdentityLike): boolean {
  if (INTERNAL_IDENTITY_TYPES.has(identity.type)) return false
  if (identity.type === "lead_id") return true
  if (DISPLAYABLE_IDENTITY_TYPES.has(identity.type)) return true
  const display = identity.value?.trim() || identity.normalizedValue.trim()
  return display.length > 0 && !isRawUuid(display)
}

export function getRadarIdentityDisplayValue(identity: RadarIdentityLike): string {
  if (identity.type === "lead_id") {
    return identity.value?.trim() || identity.normalizedValue.trim() || "Lead"
  }
  return identity.value?.trim() || identity.normalizedValue.trim() || "—"
}

/** Deep-link canônico do CRM (Board via /crm) por leadCode. */
export function buildLeadCrmHref(supabaseId: string, leadCode: string): string {
  const params = new URLSearchParams()
  params.set("leadCode", leadCode)
  return `/${supabaseId}/crm?${params.toString()}`
}

export function filterDisplayableIdentities<T extends RadarIdentityLike>(identities: T[]): T[] {
  return identities.filter(isDisplayableRadarIdentity)
}
