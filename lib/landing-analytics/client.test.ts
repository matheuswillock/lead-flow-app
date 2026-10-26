import { describe, expect, test } from "bun:test"
import { createLandingAnalyticsEvent, landingAnalyticsEndpoint } from "./client"
import { API_CLIENT_BASE } from "@/lib/route-map"

describe("landing analytics client contract", () => {
  test("builds an attributed event without leaking raw values", () => {
    const event = createLandingAnalyticsEvent(
      {
        landingPageId: "landing-1",
        publicationId: "landing-1:2",
        templateSlug: "alvora",
        visitorSessionId: "visitor_1234567890",
        attribution: { campaign_id: "campaign-1", utm_source: "email" },
      },
      "landing.cta_click",
      { destination: "https://example.test/?token=secret&utm_campaign=summer", ip: "127.0.0.1" },
    )

    expect(event.attribution.campaignId).toBe("campaign-1")
    expect(event.metadata).toEqual({ destination: "https://example.test/?utm_campaign=summer" })
  })

  test("uses the public landing endpoint", () => {
    expect(landingAnalyticsEndpoint("landing/1")).toBe(
      `${API_CLIENT_BASE}/public-landing-pages/landing%2F1/analytics/events`,
    )
  })
})
