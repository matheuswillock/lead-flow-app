import { RadarConsentStatus, RadarSourceType } from "@prisma/client"

export type RadarProfilesExportQuery = {
  search?: string
  consent?: RadarConsentStatus
  sourceType?: RadarSourceType
  channel?: "email" | "whatsapp"
  lastSeenFrom?: string
  lastSeenTo?: string
}

export type ParseRadarProfilesExportQueryResult =
  | { ok: true; value: RadarProfilesExportQuery }
  | { ok: false; error: string }

const CONSENT_VALUES = new Set<string>(Object.values(RadarConsentStatus))
const SOURCE_TYPE_VALUES = new Set<string>(Object.values(RadarSourceType))
const CHANNEL_VALUES = new Set(["email", "whatsapp"])

function parseOptionalIsoDate(raw: string | null, field: string): { ok: true; value?: string } | { ok: false; error: string } {
  if (raw == null || raw.trim() === "") {
    return { ok: true, value: undefined }
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: `Parâmetro inválido: ${field}` }
  }
  return { ok: true, value: raw }
}

export function parseRadarProfilesExportQuery(
  searchParams: URLSearchParams
): ParseRadarProfilesExportQueryResult {
  const search = searchParams.get("search") ?? undefined

  const consentRaw = searchParams.get("consent")
  if (consentRaw != null && consentRaw !== "" && !CONSENT_VALUES.has(consentRaw)) {
    return { ok: false, error: "Parâmetro inválido: consent" }
  }

  const sourceTypeRaw = searchParams.get("sourceType")
  if (sourceTypeRaw != null && sourceTypeRaw !== "" && !SOURCE_TYPE_VALUES.has(sourceTypeRaw)) {
    return { ok: false, error: "Parâmetro inválido: sourceType" }
  }

  const channelRaw = searchParams.get("channel")
  if (channelRaw != null && channelRaw !== "" && !CHANNEL_VALUES.has(channelRaw)) {
    return { ok: false, error: "Parâmetro inválido: channel" }
  }

  const lastSeenFromParsed = parseOptionalIsoDate(searchParams.get("lastSeenFrom"), "lastSeenFrom")
  if (!lastSeenFromParsed.ok) return lastSeenFromParsed

  const lastSeenToParsed = parseOptionalIsoDate(searchParams.get("lastSeenTo"), "lastSeenTo")
  if (!lastSeenToParsed.ok) return lastSeenToParsed

  return {
    ok: true,
    value: {
      search: search || undefined,
      consent: consentRaw ? (consentRaw as RadarConsentStatus) : undefined,
      sourceType: sourceTypeRaw ? (sourceTypeRaw as RadarSourceType) : undefined,
      channel: channelRaw ? (channelRaw as "email" | "whatsapp") : undefined,
      lastSeenFrom: lastSeenFromParsed.value,
      lastSeenTo: lastSeenToParsed.value,
    },
  }
}
