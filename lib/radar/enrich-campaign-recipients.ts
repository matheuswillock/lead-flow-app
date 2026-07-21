import { normalizeRadarEmail } from "@/lib/radar/normalization"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import {
  mergeRecipientInterpolationFields,
  resolveRecipientInterpolationBatch,
  type RecipientForInterpolation,
} from "@/lib/radar/resolve-recipient-interpolation"

export async function enrichCampaignRecipientsWithRadar(
  teamId: string,
  recipients: RecipientForInterpolation[],
  options?: { radarEnabled?: boolean }
): Promise<RecipientForInterpolation[]> {
  const hasRadar = options?.radarEnabled ?? (await teamHasRadarFeature(teamId))
  if (!hasRadar || recipients.length === 0) {
    return recipients
  }

  const normalizedEmails = recipients.map((recipient) => normalizeRadarEmail(recipient.email))
  const interpolationByEmail = await resolveRecipientInterpolationBatch(teamId, normalizedEmails)

  return recipients.map((recipient) => {
    const normalizedEmail = normalizeRadarEmail(recipient.email)
    const interpolation = interpolationByEmail.get(normalizedEmail)
    return mergeRecipientInterpolationFields(recipient, interpolation)
  })
}
