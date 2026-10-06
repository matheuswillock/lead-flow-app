import { z } from "zod"

export const LANDING_ANALYTICS_EVENT_TYPES = [
  "landing.page_view",
  "landing.returning_visit",
  "landing.page_milestone",
  "landing.scroll_depth",
  "landing.cta_click",
  "landing.button_click",
  "landing.link_click",
  "landing.menu_click",
  "landing.policy_navigation",
  "landing.form_start",
  "landing.form_step_view",
  "landing.form_answer_change",
  "landing.form_validation_failure",
  "landing.form_submit_attempt",
  "landing.form_submitted",
  "landing.lead_created",
  "landing.consent_updated",
] as const

export const landingAnalyticsEventSchema = z.object({
  eventId: z.string().min(16).max(128),
  eventType: z.enum(LANDING_ANALYTICS_EVENT_TYPES),
  schemaVersion: z.literal(1),
  landingPageId: z.string().min(1).max(100),
  publicationId: z.string().min(1).max(100),
  templateSlug: z.enum(["black-and-white", "alvora"]),
  visitorSessionId: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
  occurredAt: z.string().datetime({ offset: true }),
  attribution: z
    .object({
      campaignId: z.string().max(200).optional(),
      emailLogId: z.string().max(200).optional(),
      source: z.string().max(200).optional(),
      medium: z.string().max(200).optional(),
      campaign: z.string().max(200).optional(),
    })
    .default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export type LandingAnalyticsEvent = z.infer<typeof landingAnalyticsEventSchema>

const SENSITIVE_QUERY_KEYS = new Set(["token", "access_token", "code", "secret", "key"])

export function sanitizeLandingEvent(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized = Object.fromEntries(
    Object.entries(input).filter(([key]) => !["ip", "cookie", "cookies", "answerValue"].includes(key)),
  )
  const destination = sanitized.destination
  if (typeof destination === "string") {
    try {
      const url = new URL(destination)
      for (const key of SENSITIVE_QUERY_KEYS) url.searchParams.delete(key)
      sanitized.destination = url.toString()
    } catch {
      delete sanitized.destination
    }
  }
  return sanitized
}
