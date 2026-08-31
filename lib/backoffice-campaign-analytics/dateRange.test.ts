import { describe, expect, it } from "bun:test"
import { CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS, resolveCampaignAnalyticsDateRange } from "./dateRange"

describe("resolveCampaignAnalyticsDateRange", () => {
  it("resolve from/to em dia fechado UTC [from 00:00, to+1 00:00)", () => {
    const result = resolveCampaignAnalyticsDateRange({ from: "2026-08-26", to: "2026-08-31" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.from.toISOString()).toBe("2026-08-26T00:00:00.000Z")
    expect(result.value.to.toISOString()).toBe("2026-09-01T00:00:00.000Z")
  })

  it("aceita from === to como range de 1 dia", () => {
    const result = resolveCampaignAnalyticsDateRange({ from: "2026-08-31", to: "2026-08-31" })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.to.toISOString()).toBe("2026-09-01T00:00:00.000Z")
  })

  it("rejeita from ausente", () => {
    const result = resolveCampaignAnalyticsDateRange({ from: null, to: "2026-08-31" })
    expect(result.ok).toBe(false)
  })

  it("rejeita to ausente", () => {
    const result = resolveCampaignAnalyticsDateRange({ from: "2026-08-31", to: null })
    expect(result.ok).toBe(false)
  })

  it("rejeita data inválida", () => {
    const result = resolveCampaignAnalyticsDateRange({ from: "não-é-data", to: "2026-08-31" })
    expect(result.ok).toBe(false)
  })

  it("rejeita to antes de from", () => {
    const result = resolveCampaignAnalyticsDateRange({ from: "2026-08-31", to: "2026-08-01" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("período")
  })

  it(`aceita range de exatamente ${CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS} dias`, () => {
    const result = resolveCampaignAnalyticsDateRange({ from: "2026-06-01", to: "2026-08-31" })
    expect(result.ok).toBe(true)
  })

  it(`rejeita range acima de ${CAMPAIGN_ANALYTICS_MAX_RANGE_DAYS} dias com mensagem PT-BR clara`, () => {
    const result = resolveCampaignAnalyticsDateRange({ from: "2026-05-31", to: "2026-08-31" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("92")
  })
})
