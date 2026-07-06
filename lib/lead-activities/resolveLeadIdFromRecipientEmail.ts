import { cdpRepository } from "@/app/api/infra/data/repositories/cdp/CdpRepository"
import { normalizeCdpEmail } from "@/lib/cdp/normalization"
import { getLeadIdFromProfile } from "@/lib/cdp/resolve-field-value"

export async function resolveLeadIdFromRecipientEmail(
  teamId: string,
  email: string
): Promise<string | null> {
  const normalizedEmail = normalizeCdpEmail(email)
  if (!normalizedEmail) return null

  const profiles = await cdpRepository.findProfilesForInterpolationByEmails(teamId, [normalizedEmail])
  const profile = profiles.find((item) => item.normalizedPrimaryEmail === normalizedEmail)
  if (!profile) return null

  return getLeadIdFromProfile(profile)
}
