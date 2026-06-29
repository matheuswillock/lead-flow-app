import { normalizeCdpEmail } from "@/lib/cdp/normalization"
import { cdpRepository } from "@/app/api/infra/data/repositories/cdp/CdpRepository"
import { teamHasCdpFeature } from "@/lib/cdp/team-has-cdp-feature"
import {
  mergeRecipientInterpolationFields,
  resolveRecipientInterpolationBatch,
  type RecipientForInterpolation,
} from "@/lib/cdp/resolve-recipient-interpolation"

export async function enrichCampaignRecipientsWithCdp(
  teamId: string,
  recipients: RecipientForInterpolation[],
  options?: { cdpEnabled?: boolean }
): Promise<RecipientForInterpolation[]> {
  const hasCdp = options?.cdpEnabled ?? (await teamHasCdpFeature(teamId))
  if (!hasCdp || recipients.length === 0) {
    return recipients
  }

  const normalizedEmails = recipients.map((recipient) => normalizeCdpEmail(recipient.email))
  const interpolationByEmail = await resolveRecipientInterpolationBatch(teamId, normalizedEmails)

  return recipients.map((recipient) => {
    const normalizedEmail = normalizeCdpEmail(recipient.email)
    const interpolation = interpolationByEmail.get(normalizedEmail)
    return mergeRecipientInterpolationFields(recipient, interpolation)
  })
}
