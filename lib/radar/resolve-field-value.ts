import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { RadarConsentStatus, RadarSourceType } from "@prisma/client"
import { getRadarFieldCatalogEntry } from "@/lib/radar/field-catalog"

export type RadarResolvableProfile = {
  displayName: string
  displayPhone: string
  primaryEmail: string | null
  primaryDocument: string | null
  lastSeenAt: Date | null
  consents: Array<{ channel: string; status: RadarConsentStatus }>
  sourceLinks: Array<{ sourceType: RadarSourceType; sourceMetadata: unknown }>
  identities: Array<{ type: string; normalizedValue: string }>
}

export type RadarResolvableLead = {
  status: string
  currentHealthPlan: string | null
  soldPlan: string | null
  contractDueDate: Date | null
  referenceHospital: string | null
  city?: string | null
} | null

export type RadarResolvablePortfolio = {
  renewalStatus: string
  portfolioStatus: string
  renewalAmount: unknown
} | null

function formatFieldValue(value: unknown, valueType: "string" | "number" | "date"): string {
  if (value == null || value === "") return ""
  if (valueType === "date" && value instanceof Date) {
    return format(value, "dd/MM/yyyy", { locale: ptBR })
  }
  if (valueType === "number" && typeof value === "object" && value !== null && "toString" in value) {
    return String(value)
  }
  return String(value)
}

function getLeadId(profile: RadarResolvableProfile): string | null {
  const leadIdentity = profile.identities.find((identity) => identity.type === "lead_id")
  return leadIdentity?.normalizedValue ?? null
}

function getPortfolioMetadata(profile: RadarResolvableProfile): RadarResolvablePortfolio {
  const link = profile.sourceLinks.find((item) => item.sourceType === "portfolio")
  if (!link?.sourceMetadata || typeof link.sourceMetadata !== "object") return null
  const meta = link.sourceMetadata as Record<string, unknown>
  return {
    renewalStatus: String(meta.renewalStatus ?? ""),
    portfolioStatus: String(meta.portfolioStatus ?? ""),
    renewalAmount: meta.renewalAmount ?? null,
  }
}

export function resolveRadarFieldValue(
  radarFieldKey: string,
  profile: RadarResolvableProfile,
  lead: RadarResolvableLead
): string {
  const entry = getRadarFieldCatalogEntry(radarFieldKey)
  if (!entry) return ""

  switch (entry.sourceType) {
    case "PROFILE": {
      const profileRecord = profile as unknown as Record<string, unknown>
      return formatFieldValue(profileRecord[entry.path], entry.valueType)
    }
    case "CRM": {
      if (!lead) return ""
      const leadRecord = lead as unknown as Record<string, unknown>
      return formatFieldValue(leadRecord[entry.path], entry.valueType)
    }
    case "PORTFOLIO": {
      const portfolio = getPortfolioMetadata(profile)
      if (!portfolio) return ""
      const portfolioRecord = portfolio as unknown as Record<string, unknown>
      return formatFieldValue(portfolioRecord[entry.path], entry.valueType)
    }
    case "EMAIL": {
      if (entry.path === "consentStatus") {
        const emailConsent = profile.consents.find((consent) => consent.channel === "email")
        return emailConsent?.status ?? "unknown"
      }
      return ""
    }
    default:
      return ""
  }
}

export function buildProfileDataMap(
  variables: Array<{ key: string; radarFieldKey: string | null }>,
  profile: RadarResolvableProfile,
  lead: RadarResolvableLead
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const variable of variables) {
    if (!variable.radarFieldKey) continue
    const value = resolveRadarFieldValue(variable.radarFieldKey, profile, lead)
    if (value) {
      result[variable.key.toLowerCase()] = value
    }
  }
  return result
}

export function getLeadIdFromProfile(profile: RadarResolvableProfile): string | null {
  return getLeadId(profile)
}
