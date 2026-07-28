import { describe, expect, it } from "bun:test"
import {
  BACKOFFICE_ADHESION_CYCLE_MONTHS,
  resolveCardMonthlyPriceFromRule,
} from "./adhesion-pricing"

describe("resolveCardMonthlyPriceFromRule", () => {
  it("trata price como total do ciclo em CUSTOM", () => {
    const monthly = resolveCardMonthlyPriceFromRule(
      { price: { toString: () => "3180" } as never, installmentSplitMode: "CUSTOM" },
      "quarterly"
    )
    expect(monthly).toBe(1060)
    expect(monthly * BACKOFFICE_ADHESION_CYCLE_MONTHS.quarterly).toBe(3180)
  })

  it("mantém price como mensal em EQUAL", () => {
    const monthly = resolveCardMonthlyPriceFromRule(
      { price: { toString: () => "199.9" } as never, installmentSplitMode: "EQUAL" },
      "monthly"
    )
    expect(monthly).toBe(199.9)
  })
})
