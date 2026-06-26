import { cdpRepository } from "@/app/api/infra/data/repositories/cdp/CdpRepository"
import type { CdpSegmentSlug } from "@/lib/cdp/segment-config"
import { isCdpSegmentSlug, RECENT_CAMPAIGN_WINDOW_DAYS } from "@/lib/cdp/segment-config"
import { profileMatchesCdpSegment } from "@/lib/cdp/segment-rules"

export type CdpSegmentEmailRecipient = {
  email: string
  name: string | null
  customFields: Record<string, unknown> | null
}

export async function listCdpSegmentEmailRecipients(
  teamId: string,
  segmentSlug: string
): Promise<CdpSegmentEmailRecipient[]> {
  if (!isCdpSegmentSlug(segmentSlug)) return []

  const profiles = await cdpRepository.listProfilesForSegmentation(teamId)
  const leadStatuses = await cdpRepository.findLeadStatuses(
    teamId,
    profiles.flatMap((profile) => profile.identities.map((identity) => identity.normalizedValue))
  )
  const now = Date.now()
  const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000

  const recipients: CdpSegmentEmailRecipient[] = []
  const seen = new Set<string>()

  for (const profile of profiles) {
    if (!profileMatchesCdpSegment(profile, segmentSlug as CdpSegmentSlug, leadStatuses, now, recentMs)) {
      continue
    }
    if (!profile.normalizedPrimaryEmail) continue
    if (!profileMatchesCdpSegment(profile, "email_marketable", leadStatuses, now, recentMs)) continue

    const email = profile.normalizedPrimaryEmail
    if (seen.has(email)) continue
    seen.add(email)
    recipients.push({
      email,
      name: profile.displayName ?? null,
      customFields: null,
    })
  }

  return recipients
}
