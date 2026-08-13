import { describe, expect, it } from "bun:test"
import { extractCampaignEventConditions } from "./campaign-segment-preset"
import {
  parseRadarSegmentRules,
  RADAR_SEGMENT_MAX_CONDITIONS,
  type RadarSegmentRules,
} from "@/lib/radar/segment-dsl"

function mergeParentAndChild(
  parentRules: RadarSegmentRules,
  childRules: RadarSegmentRules
): RadarSegmentRules {
  const mergedConditions = [...parentRules.conditions, ...childRules.conditions]
  if (mergedConditions.length > RADAR_SEGMENT_MAX_CONDITIONS) {
    throw new Error(`Limite excedido: total de ${mergedConditions.length}`)
  }
  return { match: "all", conditions: mergedConditions }
}

describe("hierarchical segment generation (merge helpers)", () => {
  it("mescla condições do pai com as do filho em AND", () => {
    const parent = parseRadarSegmentRules({
      match: "any",
      conditions: [{ kind: "consent", channel: "email", status: "allowed" }],
    })
    const child = parseRadarSegmentRules({
      match: "all",
      conditions: [{ kind: "engagement_band", bands: ["hot"] }],
    })

    const merged = mergeParentAndChild(parent, child)
    expect(merged.match).toBe("all")
    expect(merged.conditions).toHaveLength(2)
    expect(merged.conditions[0]).toEqual(parent.conditions[0])
    expect(merged.conditions[1]).toEqual(child.conditions[0])
  })

  it("rejeita merge acima do limite de condições", () => {
    const parentConditions = Array.from({ length: 8 }, (_, i) => ({
      kind: "event" as const,
      eventType: `email.opened.${i}`,
      occurrence: "occurred" as const,
      windowDays: 30,
    }))
    const childConditions = Array.from({ length: 3 }, (_, i) => ({
      kind: "event" as const,
      eventType: `email.clicked.${i}`,
      occurrence: "occurred" as const,
      windowDays: 30,
    }))

    expect(() =>
      mergeParentAndChild(
        { match: "all", conditions: parentConditions },
        { match: "all", conditions: childConditions }
      )
    ).toThrow(/Limite excedido/)
  })

  it("extrai condições de campanha com eventTypes canônicos", () => {
    const conditions = extractCampaignEventConditions(
      "11111111-1111-1111-1111-111111111111",
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    )
    expect(conditions).toHaveLength(2)
    expect(conditions.map((c) => (c.kind === "event" ? c.eventType : ""))).toEqual([
      "form.started",
      "form.completed",
    ])
    const started = conditions[0]
    const completed = conditions[1]
    if (started?.kind !== "event" || completed?.kind !== "event") {
      throw new Error("expected event conditions")
    }
    expect(started.occurrence).toBe("occurred")
    expect(completed.occurrence).toBe("not_occurred")
    expect(started.campaignId).toBe("11111111-1111-1111-1111-111111111111")
    expect(started.windowDays).toBeGreaterThanOrEqual(30)
  })

  it("não extrai condições se campanha não tem sentAt", () => {
    expect(extractCampaignEventConditions("11111111-1111-1111-1111-111111111111", null)).toEqual([])
  })
})
