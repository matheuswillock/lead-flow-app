import { describe, expect, it } from "bun:test"
import { mapPlanSubscription } from "./BackofficePlatformUsersRepository"

describe("mapPlanSubscription — normalização de ciclo legado (achado cursor[bot] no PR #1134)", () => {
  it("sem adesão, subscriptionCycle=SEMIANNUALLY (enum legado) → cycle normalizado 'semiannual', listAmount preenchido", () => {
    const result = mapPlanSubscription({
      subscriptionCycle: "SEMIANNUALLY",
      product: {
        name: "CRM",
        priceMonthly: null,
        priceQuarterly: null,
        priceQuadrimester: null,
        priceSemiannual: { toString: () => "419.40" } as never,
        priceAnnual: null,
      },
      adhesion: null,
    })

    expect(result?.cycle).toBe("semiannual")
    expect(result?.listAmount).toBe(419.4)
  })

  it("sem adesão, subscriptionCycle=YEARLY (enum legado) → cycle normalizado 'annual', listAmount preenchido", () => {
    const result = mapPlanSubscription({
      subscriptionCycle: "YEARLY",
      product: {
        name: "CRM",
        priceMonthly: null,
        priceQuarterly: null,
        priceQuadrimester: null,
        priceSemiannual: null,
        priceAnnual: { toString: () => "958.80" } as never,
      },
      adhesion: null,
    })

    expect(result?.cycle).toBe("annual")
    expect(result?.listAmount).toBe(958.8)
  })

  it("com adesão vinculada → cycle vem da adesão (fonte da venda), ignora subscriptionCycle legado", () => {
    const result = mapPlanSubscription({
      subscriptionCycle: "MONTHLY",
      product: { name: "Member PRO", priceMonthly: null, priceQuarterly: { toString: () => "274.20" } as never, priceQuadrimester: null, priceSemiannual: null, priceAnnual: null },
      adhesion: { cycle: "quarterly", totalAmount: { toString: () => "91.40" } as never, negotiatedTotalAmount: null },
    })

    expect(result?.cycle).toBe("quarterly")
    expect(result?.chargedAmount).toBe(91.4)
    expect(result?.listAmount).toBe(274.2)
  })
})
