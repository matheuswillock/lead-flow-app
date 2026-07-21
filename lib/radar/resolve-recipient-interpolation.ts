import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import {
  buildProfileDataMap,
  getLeadIdFromProfile,
  type RadarResolvableLead,
  type RadarResolvableProfile,
} from "@/lib/radar/resolve-field-value"

export type RadarEmailVariableConfig = {
  key: string
  radarFieldKey: string | null
  defaultValue: string | null
}

export type ResolvedRecipientInterpolation = {
  radarValues: Record<string, string>
  displayName: string | null
}

export type RecipientForInterpolation = {
  contactId?: string | null
  email: string
  name?: string | null
  customFields?: Record<string, unknown> | null
}

export function resolveInterpolationValuesForProfile(
  variables: RadarEmailVariableConfig[],
  profile: RadarResolvableProfile,
  lead: RadarResolvableLead,
  materializedData?: Record<string, string>
): Record<string, string> {
  const radarValues = { ...buildProfileDataMap(variables, profile, lead) }

  if (materializedData) {
    for (const [key, value] of Object.entries(materializedData)) {
      const normalizedKey = key.toLowerCase()
      if (!radarValues[normalizedKey] && value.trim() !== "") {
        radarValues[normalizedKey] = value
      }
    }
  }

  for (const variable of variables) {
    const normalizedKey = variable.key.toLowerCase()
    if (!radarValues[normalizedKey] && variable.defaultValue) {
      radarValues[normalizedKey] = variable.defaultValue
    }
  }

  return radarValues
}

export async function resolveRecipientInterpolationBatch(
  teamId: string,
  normalizedEmails: string[]
): Promise<Map<string, ResolvedRecipientInterpolation>> {
  const unique = [...new Set(normalizedEmails.filter(Boolean))]
  if (unique.length === 0) return new Map()

  const [profiles, variables, materializedByEmail] = await Promise.all([
    radarRepository.findProfilesForInterpolationByEmails(teamId, unique),
    radarRepository.listRadarEmailVariables(teamId),
    radarRepository.findProfileDataByEmails(teamId, unique),
  ])

  const leadIds = profiles
    .map((profile) => getLeadIdFromProfile(profile))
    .filter((leadId): leadId is string => Boolean(leadId))
  const leadsById = await radarRepository.findLeadsForRadarFieldResolution(teamId, leadIds)

  const result = new Map<string, ResolvedRecipientInterpolation>()

  for (const profile of profiles) {
    if (!profile.normalizedPrimaryEmail) continue

    const leadId = getLeadIdFromProfile(profile)
    const lead = leadId ? (leadsById.get(leadId) ?? null) : null
    const materialized = materializedByEmail.get(profile.normalizedPrimaryEmail)

    const radarValues = resolveInterpolationValuesForProfile(
      variables,
      profile,
      lead,
      materialized
    )

    result.set(profile.normalizedPrimaryEmail, {
      radarValues,
      displayName: profile.displayName?.trim() || null,
    })
  }

  return result
}

/**
 * Precedência do merge em customFields:
 * 1. Valores Radar resolvidos (incl. fallback defaultValue da variável Radar)
 * 2. Campos manuais do contato (sobrescrevem Radar quando preenchidos)
 *
 * Defaults STATIC e fallback do template são aplicados em interpolateEmailTemplate.
 */
export function mergeRecipientInterpolationFields(
  recipient: RecipientForInterpolation,
  interpolation: ResolvedRecipientInterpolation | undefined
): RecipientForInterpolation {
  const manualFields = recipient.customFields ?? {}
  const merged: Record<string, unknown> = { ...(interpolation?.radarValues ?? {}) }

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
