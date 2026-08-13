export const LEAD_ORIGIN_FILTER_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "public_form", label: "Formulário público" },
  { value: "email_campaign", label: "Campanha de e-mail" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outros" },
] as const

export type LeadOriginFilterValue = (typeof LEAD_ORIGIN_FILTER_OPTIONS)[number]["value"]

export type LeadOriginFilterInput = {
  originChannel?: string | null
  originMetadata?: { attribution?: string } | null
  isTransfer: boolean
}

export function parseLeadOriginFilter(value: unknown): LeadOriginFilterValue | "" {
  if (
    value === "manual" ||
    value === "public_form" ||
    value === "email_campaign" ||
    value === "transfer" ||
    value === "other"
  ) {
    return value
  }
  return ""
}

/** Presets antigos só tinham `onlyTransfer`; mapeia para Origem = Transferência. */
export function resolveLeadOriginFilter(
  originFilter: unknown,
  onlyTransfer: boolean,
): LeadOriginFilterValue | "" {
  const parsed = parseLeadOriginFilter(originFilter)
  if (parsed) return parsed
  return onlyTransfer ? "transfer" : ""
}

export function leadOriginFilterLabel(value: string): string | null {
  return LEAD_ORIGIN_FILTER_OPTIONS.find((option) => option.value === value)?.label ?? null
}

function originAttribution(
  metadata: LeadOriginFilterInput["originMetadata"],
): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined
  return typeof metadata.attribution === "string" ? metadata.attribution : undefined
}

export function leadMatchesOriginFilter(
  lead: LeadOriginFilterInput,
  originFilter: string,
): boolean {
  if (!originFilter) return true
  if (originFilter === "transfer") return lead.isTransfer === true

  const attribution = originAttribution(lead.originMetadata)
  if (originFilter === "email_campaign") {
    return (
      lead.originChannel === "email_campaign" ||
      lead.originChannel === "email_campaign_form" ||
      attribution === "email_campaign"
    )
  }
  if (originFilter === "public_form") {
    return lead.originChannel === "public_form" && attribution !== "email_campaign"
  }
  if (originFilter === "manual") {
    return lead.originChannel === "manual" || lead.originChannel == null
  }
  if (originFilter === "other") {
    // csv_import, meta/studio webhooks, whatsapp_manual, legacy_public_widget, etc.
    if (lead.originChannel == null || lead.originChannel === "manual") return false
    if (
      lead.originChannel === "email_campaign" ||
      lead.originChannel === "email_campaign_form" ||
      attribution === "email_campaign"
    ) {
      return false
    }
    if (lead.originChannel === "public_form") return false
    return true
  }
  return true
}

export function extractOriginAttribution(
  metadata: unknown,
): { attribution?: string } | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const attribution = (metadata as Record<string, unknown>).attribution
  if (typeof attribution !== "string" || !attribution.trim()) return null
  return { attribution }
}
