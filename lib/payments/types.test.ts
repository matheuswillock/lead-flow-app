import { describe, expect, it } from "bun:test"
import { isChargePurpose, isPaymentCohort } from "./types"

describe("guards de tipos do ledger", () => {
  it("aceita só coortes conhecidas", () => {
    expect(isPaymentCohort("ASAAS")).toBe(true)
    expect(isPaymentCohort("ROUTER")).toBe(true)
    expect(isPaymentCohort("OUTRO")).toBe(false)
    expect(isPaymentCohort(undefined)).toBe(false)
  })

  it("aceita só finalidades conhecidas", () => {
    expect(isChargePurpose("SUBSCRIPTION_RENEWAL")).toBe(true)
    expect(isChargePurpose("QUALQUER")).toBe(false)
  })
})
