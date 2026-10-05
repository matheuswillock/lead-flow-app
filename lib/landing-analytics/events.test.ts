import { describe, expect, it } from "bun:test"
import { landingAnalyticsEventSchema, sanitizeLandingEvent } from "./events"

describe("landing analytics event contract", () => {
  it("accepts a campaign-aware CTA event", () => {
    const result = landingAnalyticsEventSchema.safeParse({
      eventId: "event-1234567890123456",
      eventType: "landing.cta_click",
      schemaVersion: 1,
      landingPageId: "landing-1",
      publicationId: "publication-1",
      templateSlug: "black-and-white",
      visitorSessionId: "session-1234567890123456",
      occurredAt: "2026-10-05T12:00:00.000Z",
      attribution: { campaignId: "campaign-1", emailLogId: "email-log-1" },
      metadata: { elementId: "hero-primary", destination: "#landing-form" },
    })

    expect(result.success).toBe(true)
  })

  it("removes raw IP, cookies and sensitive query parameters before delivery", () => {
    expect(
      sanitizeLandingEvent({
        ip: "192.0.2.1",
        cookie: "session-secret",
        destination: "https://example.test/?token=secret&utm_campaign=summer",
        answerValue: "sensitive answer",
      }),
    ).toEqual({ destination: "https://example.test/?utm_campaign=summer" })
  })
})
