import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { normalizeRadarEmail } from "@/lib/radar/normalization"
import { getLeadIdFromProfile } from "@/lib/radar/resolve-field-value"

export async function resolveLeadIdFromRecipientEmail(
  teamId: string,
  email: string
): Promise<string | null> {
  const normalizedEmail = normalizeRadarEmail(email)
  if (!normalizedEmail) return null

  const profiles = await radarRepository.findProfilesForInterpolationByEmails(teamId, [normalizedEmail])
  const profile = profiles.find((item) => item.normalizedPrimaryEmail === normalizedEmail)
  if (!profile) return null

  return getLeadIdFromProfile(profile)
}
