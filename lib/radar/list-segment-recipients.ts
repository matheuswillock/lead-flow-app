import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import type { RadarSegmentSlug } from "@/lib/radar/segment-config"
import { isRadarSegmentSlug, RECENT_CAMPAIGN_WINDOW_DAYS } from "@/lib/radar/segment-config"
import { profileMatchesRadarSegment } from "@/lib/radar/segment-rules"

export type RadarSegmentEmailRecipient = {
  email: string
  name: string | null
  customFields: Record<string, unknown> | null
}

export async function listRadarSegmentEmailRecipients(
  teamId: string,
  segmentSlug: string
): Promise<RadarSegmentEmailRecipient[]> {
  if (!isRadarSegmentSlug(segmentSlug)) return []

  const profiles = await radarRepository.listProfilesForSegmentation(teamId)
  const rawLeadStatuses = await radarRepository.findLeadStatuses(
    teamId,
    profiles.flatMap((profile) => profile.identities.map((identity) => identity.normalizedValue))
  )
  const leadStatuses = new Map(
    [...rawLeadStatuses.entries()].flatMap(([key, status]) => (status ? [[key, status] as const] : []))
  )
  const now = Date.now()
  const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000

  const recipients: RadarSegmentEmailRecipient[] = []
  const seen = new Set<string>()

  for (const profile of profiles) {
    if (!profileMatchesRadarSegment(profile, segmentSlug as RadarSegmentSlug, leadStatuses, now, recentMs)) {
      continue
    }
    if (!profile.normalizedPrimaryEmail) continue
    if (!profileMatchesRadarSegment(profile, "email_marketable", leadStatuses, now, recentMs)) continue

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
