import { describe, expect, it } from "bun:test"
import {
  formatCampaignAnalyticsInteger,
  formatCampaignAnalyticsRate,
  formatCampaignAnalyticsScore,
} from "./campaignAnalyticsFormatters"

describe("formatCampaignAnalyticsRate", () => {
  it("formata fração 0-1 como percentual pt-BR com 1 casa", () => {
    expect(formatCampaignAnalyticsRate(0.126)).toBe("12,6%")
  })

  it("T-11.5 — null (divisor zero no backend) vira travessão, nunca 0%", () => {
    expect(formatCampaignAnalyticsRate(null)).toBe("—")
  })

  it("zero real (divisor > 0, numerador 0) permanece 0%, distinto de null", () => {
    expect(formatCampaignAnalyticsRate(0)).toBe("0,0%")
  })
})

describe("formatCampaignAnalyticsScore", () => {
  it("formata finalScore com 1 casa decimal", () => {
    expect(formatCampaignAnalyticsScore(3.7)).toBe("3,7")
  })

  it("T-11.5 — null vira travessão, nunca 0", () => {
    expect(formatCampaignAnalyticsScore(null)).toBe("—")
  })
})

describe("formatCampaignAnalyticsInteger", () => {
  it("formata milhares com separador pt-BR", () => {
    expect(formatCampaignAnalyticsInteger(57512)).toBe("57.512")
  })
})
