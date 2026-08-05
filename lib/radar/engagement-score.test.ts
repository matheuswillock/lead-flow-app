import { describe, expect, test } from "bun:test"
import {
  DEFAULT_ENGAGEMENT_CONFIG,
  DEFAULT_FORM_ENGAGEMENT_SCORE_RULES,
  computeEngagementScore,
  rankTopEngagementEvents,
  resolveEventWeight,
  type WeightMap,
} from "./engagement-score"

const WEIGHTS: WeightMap = {
  "email.clicked": 12,
  "email.opened": 5,
  "email.bounced": -30,
  "form.completed": 25,
}

const NOW = new Date("2026-08-04T12:00:00.000Z")

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

describe("computeEngagementScore", () => {
  test("score zero sem eventos", () => {
    const result = computeEngagementScore([], WEIGHTS, DEFAULT_ENGAGEMENT_CONFIG, NOW)
    expect(result).toEqual({ score: 0, band: "cold" })
  })

  test("cap em 100", () => {
    const events = Array.from({ length: 10 }, () => ({
      eventType: "form.completed",
      occurredAt: daysAgo(1),
    }))
    const result = computeEngagementScore(events, WEIGHTS, DEFAULT_ENGAGEMENT_CONFIG, NOW)
    expect(result.score).toBe(100)
    expect(result.band).toBe("hot")
  })

  test("decaimento: evento antigo < evento recente", () => {
    const recent = computeEngagementScore(
      [{ eventType: "email.clicked", occurredAt: daysAgo(1) }],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      NOW
    )
    const old = computeEngagementScore(
      [{ eventType: "email.clicked", occurredAt: daysAgo(60) }],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      NOW
    )
    expect(old.score).toBeLessThan(recent.score)
  })

  test("bounce reduz o score", () => {
    const base = computeEngagementScore(
      [{ eventType: "form.completed", occurredAt: daysAgo(1) }],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      NOW
    )
    const withBounce = computeEngagementScore(
      [
        { eventType: "form.completed", occurredAt: daysAgo(1) },
        { eventType: "email.bounced", occurredAt: daysAgo(1) },
      ],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      NOW
    )
    expect(withBounce.score).toBeLessThan(base.score)
  })

  test("banda correta derivada do score", () => {
    // form.completed recente: 25 * 2 = 50 → warm (30–59)
    const warm = computeEngagementScore(
      [{ eventType: "form.completed", occurredAt: daysAgo(1) }],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      NOW
    )
    expect(warm.score).toBe(50)
    expect(warm.band).toBe("warm")

    // dois form.completed recentes: 50 * 2 = 100 → hot
    const hot = computeEngagementScore(
      [
        { eventType: "form.completed", occurredAt: daysAgo(1) },
        { eventType: "form.completed", occurredAt: daysAgo(2) },
      ],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      NOW
    )
    expect(hot.score).toBe(100)
    expect(hot.band).toBe("hot")

    // email.opened recente: 5 * 2 = 10 → lukewarm
    const lukewarm = computeEngagementScore(
      [{ eventType: "email.opened", occurredAt: daysAgo(1) }],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      NOW
    )
    expect(lukewarm.score).toBe(10)
    expect(lukewarm.band).toBe("lukewarm")
  })

  test("eventType não mapeado é ignorado", () => {
    const result = computeEngagementScore(
      [{ eventType: "pixel.unknown_signal", occurredAt: daysAgo(1) }],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      NOW
    )
    expect(result).toEqual({ score: 0, band: "cold" })
  })
})

describe("D19-B-bis form.completed score multiplier", () => {
  test("score 90% aplica ×2,5 no peso base", () => {
    const weight = resolveEventWeight(
      {
        eventType: "form.completed",
        occurredAt: daysAgo(1),
        metadata: { origin: { submissionScorePercent: 90 } },
      },
      WEIGHTS,
      DEFAULT_FORM_ENGAGEMENT_SCORE_RULES
    )
    expect(weight).toBe(Math.round(25 * 2.5))
  })

  test("score 50% aplica ×1,0 (peso base)", () => {
    const weight = resolveEventWeight(
      {
        eventType: "form.completed",
        occurredAt: daysAgo(1),
        metadata: { origin: { submissionScorePercent: 50 } },
      },
      WEIGHTS,
      DEFAULT_FORM_ENGAGEMENT_SCORE_RULES
    )
    expect(weight).toBe(25)
  })

  test("sem submissionScorePercent usa fallback ×1,0", () => {
    const weight = resolveEventWeight(
      {
        eventType: "form.completed",
        occurredAt: daysAgo(1),
        metadata: { origin: { utmSource: "email" } },
      },
      WEIGHTS,
      DEFAULT_FORM_ENGAGEMENT_SCORE_RULES
    )
    expect(weight).toBe(25)
  })

  test("score fora de regras ativas usa fallback ×1,0", () => {
    const weight = resolveEventWeight(
      {
        eventType: "form.completed",
        occurredAt: daysAgo(1),
        metadata: { origin: { submissionScorePercent: 50 } },
      },
      WEIGHTS,
      [{ minPercent: 80, maxPercent: 100, multiplier: 2.5, label: "Alta", isActive: true }]
    )
    expect(weight).toBe(25)
  })

  test("dois form.completed com qualidades diferentes geram scores distintos", () => {
    const high = computeEngagementScore(
      [
        {
          eventType: "form.completed",
          occurredAt: daysAgo(10),
          metadata: { origin: { submissionScorePercent: 90 } },
        },
      ],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      NOW,
      DEFAULT_FORM_ENGAGEMENT_SCORE_RULES
    )
    const low = computeEngagementScore(
      [
        {
          eventType: "form.completed",
          occurredAt: daysAgo(10),
          metadata: { origin: { submissionScorePercent: 10 } },
        },
      ],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      NOW,
      DEFAULT_FORM_ENGAGEMENT_SCORE_RULES
    )
    expect(high.score).toBe(Math.round(25 * 2.5))
    expect(low.score).toBe(Math.round(25 * 0.2))
    expect(high.score).toBeGreaterThan(low.score)
  })
})

describe("rankTopEngagementEvents", () => {
  test("retorna top 3 por |weight × multiplier|", () => {
    const top = rankTopEngagementEvents(
      [
        { eventType: "email.opened", occurredAt: daysAgo(1) },
        { eventType: "form.completed", occurredAt: daysAgo(1) },
        { eventType: "email.clicked", occurredAt: daysAgo(1) },
        { eventType: "email.bounced", occurredAt: daysAgo(1) },
      ],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      3,
      NOW
    )
    expect(top).toHaveLength(3)
    expect(top[0]?.eventType).toBe("email.bounced")
    expect(Math.abs(top[0]?.contribution ?? 0)).toBeGreaterThanOrEqual(
      Math.abs(top[1]?.contribution ?? 0)
    )
  })

  test("ignora eventos fora da janela ou sem peso", () => {
    const top = rankTopEngagementEvents(
      [
        { eventType: "form.completed", occurredAt: daysAgo(120) },
        { eventType: "pixel.unknown", occurredAt: daysAgo(1) },
      ],
      WEIGHTS,
      DEFAULT_ENGAGEMENT_CONFIG,
      3,
      NOW
    )
    expect(top).toEqual([])
  })
})
