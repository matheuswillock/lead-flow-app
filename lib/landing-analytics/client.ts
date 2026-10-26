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

export type LandingFormAnalyticsDetail = {
  eventType:
    | "landing.form_start"
    | "landing.form_step_view"
    | "landing.form_answer_change"
    | "landing.form_validation_failure"
    | "landing.form_submit_attempt"
    | "landing.form_submitted"
    | "landing.lead_created"
  formId?: string
  questionId?: string
  pageId?: string
  pageIndex?: number
  validationCodes?: { questionId: string; code: string }[]
  answerPresent?: boolean
}

export const LANDING_FORM_ANALYTICS_EVENT = "landing-form-analytics"
export const LANDING_CONSENT_STORAGE_PREFIX = "landing-cookie-consent"
export function landingConsentStorageKey(landingPageId: string): string { return `${LANDING_CONSENT_STORAGE_PREFIX}:${landingPageId || "default"}` }
export const LANDING_CONSENT_ANALYTICS_EVENT = "landing-consent-analytics"

export function dispatchLandingFormAnalytics(detail: LandingFormAnalyticsDetail): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<LandingFormAnalyticsDetail>(LANDING_FORM_ANALYTICS_EVENT, { detail }))
}

export function dispatchLandingConsentAnalytics(choice: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(LANDING_CONSENT_ANALYTICS_EVENT, { detail: { choice } }))
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
