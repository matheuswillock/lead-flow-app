import { describe, expect, test } from "bun:test"
import {
  DEFAULT_ENGAGEMENT_CONFIG,
  computeEngagementScore,
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
