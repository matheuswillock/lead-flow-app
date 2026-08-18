import { describe, expect, it } from "bun:test"
import { extractCampaignEventConditions } from "./campaign-segment-preset"
import {
  mergeHierarchicalSegmentRules,
  parentRulesToBaseConditions,
} from "./merge-hierarchical-segment-rules"
import {
  parseRadarSegmentRules,
  RADAR_SEGMENT_MAX_CONDITIONS,
  type RadarSegmentRules,
} from "@/lib/radar/segment-dsl"

describe("mergeHierarchicalSegmentRules", () => {
  it("mescla base da campanha com adicionais em AND", () => {
    const base = extractCampaignEventConditions(
      "11111111-1111-1111-1111-111111111111",
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    )
    const additional = parseRadarSegmentRules({
      match: "all",
      conditions: [{ kind: "consent", channel: "email", status: "allowed" }],
    })

    const merged = mergeHierarchicalSegmentRules(base, additional)
    expect(merged.match).toBe("all")
    expect(merged.conditions).toHaveLength(3)
    expect(merged.conditions[2]).toEqual(additional.conditions[0])
  })

  it("empacota adicionais OR em condition_group", () => {
    const base = extractCampaignEventConditions(
      "11111111-1111-1111-1111-111111111111",
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    )
    const additional: RadarSegmentRules = {
      match: "any",
      conditions: [
        { kind: "event", eventType: "email.opened", occurrence: "occurred" },
        { kind: "event", eventType: "form.started", occurrence: "occurred" },
      ],
    }

    const merged = mergeHierarchicalSegmentRules(base, additional)
    expect(merged.conditions).toHaveLength(3)
    const group = merged.conditions[2]
    expect(group?.kind).toBe("condition_group")
    if (group?.kind === "condition_group") {
      expect(group.match).toBe("any")
      expect(group.conditions).toHaveLength(2)
    }
  })

  it("permite zero condições adicionais quando há base", () => {
    const base = extractCampaignEventConditions(
      "11111111-1111-1111-1111-111111111111",
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    )
    const merged = mergeHierarchicalSegmentRules(base, { match: "all", conditions: [] })
    expect(merged.conditions).toHaveLength(2)
  })

  it("rejeita merge acima do limite de condições", () => {
    const baseConditions = Array.from({ length: 8 }, (_, i) => ({
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
      mergeHierarchicalSegmentRules(baseConditions, { match: "all", conditions: childConditions })
    ).toThrow(/Limite excedido/)
  })
})

describe("parentRulesToBaseConditions", () => {
  it("preserva condições quando pai usa match all", () => {
    const parent = parseRadarSegmentRules({
      match: "all",
      conditions: [{ kind: "consent", channel: "email", status: "allowed" }],
    })
    expect(parentRulesToBaseConditions(parent)).toEqual(parent.conditions)
  })

  it("envolve pai match any em condition_group", () => {
    const parent: RadarSegmentRules = {
      match: "any",
      conditions: [
        { kind: "event", eventType: "email.opened", occurrence: "occurred" },
        { kind: "event", eventType: "email.clicked", occurrence: "occurred" },
      ],
    }
    const base = parentRulesToBaseConditions(parent)
    expect(base).toHaveLength(1)
    expect(base[0]?.kind).toBe("condition_group")
  })
})

describe("hierarchical segment generation (campaign preset)", () => {
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

  it("preview e create usam o mesmo preset de campanha", () => {
    const campaignId = "22222222-2222-2222-8222-222222222222"
    const sentAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    const preset = extractCampaignEventConditions(campaignId, sentAt)
    const merged = mergeHierarchicalSegmentRules(preset, { match: "all", conditions: [] })
    expect(merged.conditions).toEqual(preset)
    expect(merged.conditions.length).toBeLessThanOrEqual(RADAR_SEGMENT_MAX_CONDITIONS)
  })

  it("permite persistir regras mesmo quando a prévia seria 0", () => {
    const campaignId = "33333333-3333-4333-8333-333333333333"
    const sentAt = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const merged = mergeHierarchicalSegmentRules(
      extractCampaignEventConditions(campaignId, sentAt),
      { match: "all", conditions: [] }
    )
    expect(merged.conditions.length).toBeGreaterThan(0)
  })
})
