import type { LeadStatus } from "@prisma/client"
import { CRM_CLOSED_STATUSES, RECENT_CAMPAIGN_WINDOW_DAYS, type RadarSegmentSlug } from "@/lib/radar/segment-config"
import { isRealLeadIdentity } from "@/lib/radar/lead-identity"

export type RadarSegmentEvent = {
  eventType: string
  occurredAt: Date
  metadata?: unknown
}

export type RadarSegmentProfileInput = {
  normalizedPrimaryEmail: string | null
  consents: { status: string }[]
  sourceLinks: { sourceType: string; sourceMetadata?: unknown }[]
  events: RadarSegmentEvent[]
  identities: { type?: string; normalizedValue: string }[]
}

function extractCampaignId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const campaignId = (metadata as Record<string, unknown>).campaignId
  return typeof campaignId === "string" && campaignId.trim() ? campaignId.trim() : null
}

function isWithinRecentWindow(occurredAt: Date, now: number, recentMs: number): boolean {
  return now - occurredAt.getTime() <= recentMs
}

export function profileOpenedNotClickedInWindow(
  events: RadarSegmentEvent[],
  now: number,
  recentMs: number = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000
): boolean {
  const emailEvents = events.filter(
    (event) =>
      event.eventType.startsWith("email.") &&
      isWithinRecentWindow(event.occurredAt, now, recentMs)
  )

  const openedByCampaign = new Map<string, Date>()
  const clickedCampaigns = new Set<string>()

  for (const event of emailEvents) {
    const campaignId = extractCampaignId(event.metadata)
    if (!campaignId) continue

    if (event.eventType === "email.opened") {
      const existing = openedByCampaign.get(campaignId)
      if (!existing || event.occurredAt > existing) {
        openedByCampaign.set(campaignId, event.occurredAt)
      }
    }

    if (event.eventType === "email.clicked") {
      clickedCampaigns.add(campaignId)
    }
  }

  for (const campaignId of openedByCampaign.keys()) {
    if (!clickedCampaigns.has(campaignId)) return true
  }

  return false
}

export function profileClickedNotClosedInWindow(
  events: RadarSegmentEvent[],
  isClosed: boolean,
  now: number,
  recentMs: number = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000
): boolean {
  if (isClosed) return false

  return events.some(
    (event) =>
      event.eventType === "email.clicked" &&
      isWithinRecentWindow(event.occurredAt, now, recentMs) &&
      Boolean(extractCampaignId(event.metadata))
  )
}

const ENGAGEMENT_EVENT_TYPES = new Set([
  "email.opened",
  "email.clicked",
  "form.viewed",
  "form.started",
])

export function profileEngagedNoLeadInWindow(
  profile: Pick<RadarSegmentProfileInput, "events" | "identities">,
  now: number,
  recentMs: number = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000
): boolean {
  const hasLeadId = profile.identities.some(isRealLeadIdentity)
  if (hasLeadId) return false

  return profile.events.some(
    (event) =>
      ENGAGEMENT_EVENT_TYPES.has(event.eventType) &&
      isWithinRecentWindow(event.occurredAt, now, recentMs)
  )
}

export function buildEmailEventMetadata(campaignId?: string | null, extra?: Record<string, unknown>) {
  return {
    ...(extra ?? {}),
    ...(campaignId ? { campaignId } : {}),
  }
}

export function profileMatchesRadarSegment(
  profile: RadarSegmentProfileInput,
  segment: RadarSegmentSlug,
  leadStatuses: Map<string, string>,
  now: number = Date.now(),
  recentMs: number = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000
): boolean {
  const emailConsent = profile.consents[0]
  const hasEmail = Boolean(profile.normalizedPrimaryEmail)
  const emailEvents = profile.events.filter((event) => event.eventType.startsWith("email."))
  const hasPortfolio = profile.sourceLinks.some((link) => link.sourceType === "portfolio")
  const leadIdentity = profile.identities.find(isRealLeadIdentity)
  const leadId = leadIdentity?.normalizedValue ?? profile.identities[0]?.normalizedValue
  const leadStatus = leadId ? (leadStatuses.get(leadId) as LeadStatus | undefined) : undefined
  const isClosed =
    hasPortfolio || (leadStatus ? CRM_CLOSED_STATUSES.includes(leadStatus as LeadStatus) : false)
  const recentSent = emailEvents.some(
    (event) => event.eventType === "email.sent" && isWithinRecentWindow(event.occurredAt, now, recentMs)
  )

  switch (segment) {
    case "email_marketable":
      return hasEmail && (!emailConsent || emailConsent.status === "allowed")
    case "email_blocked":
      return emailConsent?.status === "blocked"
    case "opened_not_clicked":
      return profileOpenedNotClickedInWindow(profile.events, now, recentMs)
    case "clicked_not_closed":
      return profileClickedNotClosedInWindow(profile.events, isClosed, now, recentMs)
    case "portfolio_renewal_due":
      return (
        profile.events.some((event) => event.eventType === "portfolio.renewal_due") ||
        profile.sourceLinks.some((link) => {
          if (link.sourceType !== "portfolio") return false
          const meta = link.sourceMetadata as { renewalStatus?: string } | null
          return meta?.renewalStatus === "to_renew" || meta?.renewalStatus === "contacted"
        })
      )
    case "inactive_recent_campaign":
      return !recentSent
    case "portfolio_clients":
      return hasPortfolio
    case "crm_clients":
      return Boolean(profile.identities.some(isRealLeadIdentity))
    case "engaged_no_lead":
      return profileEngagedNoLeadInWindow(profile, now, recentMs)
    default: {
      const _exhaustive: never = segment
      void _exhaustive
      return false
    }
  }
}
