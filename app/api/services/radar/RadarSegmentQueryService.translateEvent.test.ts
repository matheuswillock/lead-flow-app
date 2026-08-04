import { describe, expect, it } from "bun:test"
import { translateEngagementBand, translateEvent } from "./RadarSegmentQueryService"

describe("translateEvent", () => {
  it("sem campaignId não filtra metadata", () => {
    const where = translateEvent({
      kind: "event",
      eventType: "email.opened",
      occurrence: "occurred",
    })
    expect(where).toEqual({
      events: { some: { eventType: "email.opened" } },
    })
  })

  it("com campaignId filtra metadata.path campaignId", () => {
    const campaignId = "11111111-1111-4111-8111-111111111111"
    const where = translateEvent({
      kind: "event",
      eventType: "email.clicked",
      occurrence: "occurred",
      campaignId,
    })
    expect(where).toEqual({
      events: {
        some: {
          eventType: "email.clicked",
          metadata: { path: ["campaignId"], equals: campaignId },
        },
      },
    })
  })

  it("not_occurred com campaignId usa events.none", () => {
    const campaignId = "22222222-2222-4222-8222-222222222222"
    const where = translateEvent({
      kind: "event",
      eventType: "email.opened",
      occurrence: "not_occurred",
      campaignId,
    })
    expect(where).toEqual({
      events: {
        none: {
          eventType: "email.opened",
          metadata: { path: ["campaignId"], equals: campaignId },
        },
      },
    })
  })
})

describe("translateEngagementBand", () => {
  it("traduz bands para engagementBand.in", () => {
    const where = translateEngagementBand({
      kind: "engagement_band",
      bands: ["hot", "warm"],
    })
    expect(where).toEqual({ engagementBand: { in: ["hot", "warm"] } })
  })

  it("banda única gera in com um valor", () => {
    const where = translateEngagementBand({
      kind: "engagement_band",
      bands: ["cold"],
    })
    expect(where).toEqual({ engagementBand: { in: ["cold"] } })
  })
})
