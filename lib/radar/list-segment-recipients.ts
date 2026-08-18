import type { LeadStatus } from "@prisma/client"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { teamRadarSegmentRepository } from "@/app/api/infra/data/repositories/radar/TeamRadarSegmentRepository"
import { radarSegmentQueryService } from "@/app/api/services/radar/RadarSegmentQueryService"
import type { RadarSegmentSlug } from "@/lib/radar/segment-config"
import { isRadarSegmentSlug, RECENT_CAMPAIGN_WINDOW_DAYS } from "@/lib/radar/segment-config"
import { profileMatchesRadarSegment, type RadarSegmentProfileInput } from "@/lib/radar/segment-rules"
import { parseRadarSegmentRules } from "@/lib/radar/segment-dsl"
import {
  CUSTOM_RADAR_SEGMENT_PREFIX,
  parseCampaignRadarSegmentSlug,
} from "@/lib/radar/segment-audience"

export type RadarSegmentEmailRecipient = {
  email: string
  name: string | null
  customFields: Record<string, unknown> | null
}

const SYSTEM_TEAM_CONTEXT = { profileId: "system", teamMember: { role: "system", functions: [] as string[] } }

async function buildLeadStatusMap(teamId: string, profiles: RadarSegmentProfileInput[]) {
  const rawLeadStatuses = await radarRepository.findLeadStatuses(
    teamId,
    profiles.flatMap((profile) => profile.identities.map((identity) => identity.normalizedValue))
  )
  return new Map<string, LeadStatus>(
    [...rawLeadStatuses.entries()].flatMap(([key, status]) => (status ? [[key, status] as const] : []))
  )
}

/**
 * Todo destinatário de segmento (sistema ou custom) precisa também satisfazer
 * "email_marketable" (e-mail válido + consentimento não bloqueado) e ser
 * deduplicado por e-mail — regra única, reutilizada pelos dois caminhos.
 */
function buildEmailRecipients(
  profiles: (RadarSegmentProfileInput & { displayName: string })[],
  leadStatuses: Map<string, LeadStatus>,
  now: number,
  recentMs: number
): RadarSegmentEmailRecipient[] {
  const recipients: RadarSegmentEmailRecipient[] = []
  const seen = new Set<string>()

  for (const profile of profiles) {
    if (!profile.normalizedPrimaryEmail) continue
    if (!profileMatchesRadarSegment(profile, "email_marketable", leadStatuses, now, recentMs)) continue

    const email = profile.normalizedPrimaryEmail
    if (seen.has(email)) continue
    seen.add(email)
    recipients.push({ email, name: profile.displayName ?? null, customFields: null })
  }

  return recipients
}

async function listCustomSegmentEmailRecipients(
  teamId: string,
  segmentId: string,
  now: number,
  recentMs: number
): Promise<RadarSegmentEmailRecipient[]> {
  // `isActive` só controla se o segmento pode ser SELECIONADO como audiência
  // nova (ver isValidRadarSegmentAudience) — uma vez que uma campanha já
  // referencia `custom:{id}`, a resolução de destinatários deve continuar
  // funcionando mesmo com o segmento desativado (soft-delete), senão o
  // disparo de uma campanha agendada falha com zero destinatários.
  const segment = await teamRadarSegmentRepository.findById(teamId, segmentId)
  if (!segment) return []

  const rules = parseRadarSegmentRules(segment.rulesJson)
  const profileIds = await radarSegmentQueryService.listProfileIds(
    { teamId, ctx: SYSTEM_TEAM_CONTEXT },
    rules
  )
  if (profileIds.length === 0) return []

  const profiles = await radarRepository.listProfilesForSegmentationByIds(teamId, profileIds)
  const leadStatuses = await buildLeadStatusMap(teamId, profiles)
  return buildEmailRecipients(profiles, leadStatuses, now, recentMs)
}

async function listCampaignSegmentEmailRecipients(
  teamId: string,
  campaignId: string,
  now: number,
  recentMs: number
): Promise<RadarSegmentEmailRecipient[]> {
  const campaignName = await radarRepository.findEmailCampaignName(teamId, campaignId)
  if (!campaignName) return []

  const profileIds = await radarRepository.findProfileIdsByEmailCampaign(teamId, campaignId)
  if (profileIds.length === 0) return []

  const profiles = await radarRepository.listProfilesForSegmentationByIds(teamId, profileIds)
  const leadStatuses = await buildLeadStatusMap(teamId, profiles)
  return buildEmailRecipients(profiles, leadStatuses, now, recentMs)
}

function collectProfileEmails(
  profiles: Array<{ normalizedPrimaryEmail?: string | null }>
): string[] {
  const seen = new Set<string>()
  const emails: string[] = []
  for (const profile of profiles) {
    const email = profile.normalizedPrimaryEmail?.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    emails.push(email)
  }
  return emails
}

async function listCustomSegmentProfileEmails(teamId: string, segmentId: string): Promise<string[]> {
  const segment = await teamRadarSegmentRepository.findById(teamId, segmentId)
  if (!segment) return []

  const rules = parseRadarSegmentRules(segment.rulesJson)
  const profileIds = await radarSegmentQueryService.listProfileIds(
    { teamId, ctx: SYSTEM_TEAM_CONTEXT },
    rules
  )
  if (profileIds.length === 0) return []

  const profiles = await radarRepository.listProfilesForSegmentationByIds(teamId, profileIds)
  return collectProfileEmails(profiles)
}

async function listCampaignSegmentProfileEmails(teamId: string, campaignId: string): Promise<string[]> {
  const profileIds = await radarRepository.findProfileIdsByEmailCampaign(teamId, campaignId)
  if (profileIds.length === 0) return []

  const profiles = await radarRepository.listProfilesForSegmentationByIds(teamId, profileIds)
  return collectProfileEmails(profiles)
}

export async function listRadarSegmentProfileEmails(
  teamId: string,
  segmentSlug: string
): Promise<string[]> {
  if (segmentSlug.startsWith(CUSTOM_RADAR_SEGMENT_PREFIX)) {
    return listCustomSegmentProfileEmails(
      teamId,
      segmentSlug.slice(CUSTOM_RADAR_SEGMENT_PREFIX.length)
    )
  }

  const campaignId = parseCampaignRadarSegmentSlug(segmentSlug)
  if (campaignId) {
    return listCampaignSegmentProfileEmails(teamId, campaignId)
  }

  if (!isRadarSegmentSlug(segmentSlug)) return []

  const now = Date.now()
  const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const profiles = await radarRepository.listProfilesForSegmentation(teamId)
  const leadStatuses = await buildLeadStatusMap(teamId, profiles)
  const matched = profiles.filter((profile) =>
    profileMatchesRadarSegment(profile, segmentSlug as RadarSegmentSlug, leadStatuses, now, recentMs)
  )
  return collectProfileEmails(matched)
}

export async function listRadarSegmentEmailRecipients(
  teamId: string,
  segmentSlug: string
): Promise<RadarSegmentEmailRecipient[]> {
  const now = Date.now()
  const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000

  if (segmentSlug.startsWith(CUSTOM_RADAR_SEGMENT_PREFIX)) {
    return listCustomSegmentEmailRecipients(
      teamId,
      segmentSlug.slice(CUSTOM_RADAR_SEGMENT_PREFIX.length),
      now,
      recentMs
    )
  }

  const campaignId = parseCampaignRadarSegmentSlug(segmentSlug)
  if (campaignId) {
    return listCampaignSegmentEmailRecipients(teamId, campaignId, now, recentMs)
  }

  if (!isRadarSegmentSlug(segmentSlug)) return []

  const profiles = await radarRepository.listProfilesForSegmentation(teamId)
  const leadStatuses = await buildLeadStatusMap(teamId, profiles)
  const matched = profiles.filter((profile) =>
    profileMatchesRadarSegment(profile, segmentSlug as RadarSegmentSlug, leadStatuses, now, recentMs)
  )
  return buildEmailRecipients(matched, leadStatuses, now, recentMs)
}
