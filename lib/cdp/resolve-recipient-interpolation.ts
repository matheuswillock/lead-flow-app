import { cdpRepository } from "@/app/api/infra/data/repositories/cdp/CdpRepository"
import {
  buildProfileDataMap,
  getLeadIdFromProfile,
  type CdpResolvableLead,
  type CdpResolvableProfile,
} from "@/lib/cdp/resolve-field-value"

export type CdpEmailVariableConfig = {
  key: string
  cdpFieldKey: string | null
  defaultValue: string | null
}

export type ResolvedRecipientInterpolation = {
  cdpValues: Record<string, string>
  displayName: string | null
}

export type RecipientForInterpolation = {
  email: string
  name?: string | null
  customFields?: Record<string, unknown> | null
}

export function resolveInterpolationValuesForProfile(
  variables: CdpEmailVariableConfig[],
  profile: CdpResolvableProfile,
  lead: CdpResolvableLead,
  materializedData?: Record<string, string>
): Record<string, string> {
  const cdpValues = { ...buildProfileDataMap(variables, profile, lead) }

  if (materializedData) {
    for (const [key, value] of Object.entries(materializedData)) {
      const normalizedKey = key.toLowerCase()
      if (!cdpValues[normalizedKey] && value.trim() !== "") {
        cdpValues[normalizedKey] = value
      }
    }
  }

  for (const variable of variables) {
    const normalizedKey = variable.key.toLowerCase()
    if (!cdpValues[normalizedKey] && variable.defaultValue) {
      cdpValues[normalizedKey] = variable.defaultValue
    }
  }

  return cdpValues
}

export async function resolveRecipientInterpolationBatch(
  teamId: string,
  normalizedEmails: string[]
): Promise<Map<string, ResolvedRecipientInterpolation>> {
  const unique = [...new Set(normalizedEmails.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const [profiles, variables, materializedByEmail] = await Promise.all([
    cdpRepository.findProfilesForInterpolationByEmails(teamId, unique),
    cdpRepository.listCdpEmailVariables(teamId),
    cdpRepository.findProfileDataByEmails(teamId, unique),
  ])

  const leadIds = profiles
    .map((profile) => getLeadIdFromProfile(profile))
    .filter((leadId): leadId is string => Boolean(leadId))
  const leadsById = await cdpRepository.findLeadsForCdpFieldResolution(teamId, leadIds)

  const result = new Map<string, ResolvedRecipientInterpolation>()

  for (const profile of profiles) {
    if (!profile.normalizedPrimaryEmail) continue

    const leadId = getLeadIdFromProfile(profile)
    const lead = leadId ? (leadsById.get(leadId) ?? null) : null
    const materialized = materializedByEmail.get(profile.normalizedPrimaryEmail)

    const cdpValues = resolveInterpolationValuesForProfile(
      variables,
      profile,
      lead,
      materialized
    )

    result.set(profile.normalizedPrimaryEmail, {
      cdpValues,
      displayName: profile.displayName?.trim() || null,
    })
  }

  return result
}

/**
 * Precedência do merge em customFields:
 * 1. Valores CDP resolvidos (incl. fallback defaultValue da variável CDP)
 * 2. Campos manuais do contato (sobrescrevem CDP quando preenchidos)
 *
 * Defaults STATIC e fallback do template são aplicados em interpolateEmailTemplate.
 */
export function mergeRecipientInterpolationFields(
  recipient: RecipientForInterpolation,
  interpolation: ResolvedRecipientInterpolation | undefined
): RecipientForInterpolation {
  const manualFields = recipient.customFields ?? {}
  const merged: Record<string, unknown> = { ...(interpolation?.cdpValues ?? {}) }

  for (const [key, value] of Object.entries(manualFields)) {
    if (value != null && String(value).trim() !== "") {
      merged[key.toLowerCase()] = value
    }
  }

  const resolvedName =
    recipient.name?.trim() ||
    interpolation?.displayName?.trim() ||
    recipient.name ||
    undefined

  return {
    ...recipient,
    name: resolvedName,
    customFields: merged,
  }
}
