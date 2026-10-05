import { normalizeLandingAttribution } from "./attribution"
import { sanitizeLandingEvent, type LandingAnalyticsEvent } from "./events"
import { API_CLIENT_BASE } from "@/lib/route-map"

export type LandingAnalyticsContext = {
  landingPageId: string
  publicationId: string
  templateSlug: "black-and-white" | "alvora"
  visitorSessionId: string
  attribution?: Record<string, unknown>
}

export function createLandingAnalyticsEvent(
  context: LandingAnalyticsContext,
  eventType: LandingAnalyticsEvent["eventType"],
  metadata: Record<string, unknown> = {},
): LandingAnalyticsEvent {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    schemaVersion: 1,
    landingPageId: context.landingPageId,
    publicationId: context.publicationId,
    templateSlug: context.templateSlug,
    visitorSessionId: context.visitorSessionId,
    occurredAt: new Date().toISOString(),
    attribution: normalizeLandingAttribution(context.attribution ?? {}),
    metadata: sanitizeLandingEvent(metadata),
  }
}

export function landingAnalyticsEndpoint(publicId: string): string {
  return `${API_CLIENT_BASE}/public-landing-pages/${encodeURIComponent(publicId)}/analytics/events`
}
