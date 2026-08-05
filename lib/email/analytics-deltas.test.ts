import { describe, expect, it } from "bun:test"
import { calcMetricDelta, previousPeriodRange } from "./analytics-deltas"
import { aggregateCampaignTotals, rankTopCampaigns } from "./campaign-ranking"

describe("calcMetricDelta", () => {
  it("marca up/down/neutral para taxas com limiar 0.05 pp", () => {
    expect(calcMetricDelta(10, 9, { isRate: true }).direction).toBe("up")
    expect(calcMetricDelta(9, 10, { isRate: true }).direction).toBe("down")
    expect(calcMetricDelta(10.02, 10, { isRate: true }).direction).toBe("neutral")
  })

  it("marca neutral quando contagens iguais", () => {
    expect(calcMetricDelta(5, 5).direction).toBe("neutral")
  })
})

describe("previousPeriodRange", () => {
  it("mantém a mesma duração imediatamente antes de from", () => {
    const from = new Date("2026-01-10T00:00:00.000Z")
    const to = new Date("2026-01-20T00:00:00.000Z")
    const prev = previousPeriodRange(from, to)
    expect(prev.to.toISOString()).toBe(from.toISOString())
    expect(prev.from.toISOString()).toBe("2025-12-31T00:00:00.000Z")
  })
})

describe("rankTopCampaigns", () => {
  it("ranqueia por openRate e exige mínimo de envios", () => {
    const ranked = rankTopCampaigns(
      aggregateCampaignTotals([
        {
          campaignId: "a",
          name: "A",
          sent: 100,
          delivered: 90,
          opened: 50,
          clicked: 5,
          bounced: 0,
          complained: 0,
        },
        {
          campaignId: "b",
          name: "B",
          sent: 100,
          delivered: 90,
          opened: 20,
          clicked: 5,
          bounced: 0,
          complained: 0,
        },
        {
          campaignId: "c",
          name: "C",
          sent: 5,
          delivered: 5,
          opened: 5,
          clicked: 1,
          bounced: 0,
          complained: 0,
        },
      ]),
      3,
    )
    expect(ranked).toHaveLength(2)
    expect(ranked[0].campaignId).toBe("a")
    expect(ranked[0].rank).toBe(1)
  })
})
