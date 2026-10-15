import { describe, expect, it } from "bun:test"
import { resolveIndefiniteBillingAccessAction } from "./indefiniteBillingAccessPlan"

describe("resolveIndefiniteBillingAccessAction", () => {
  it("exclui assinatura anual válida sem criar grant", () => {
    expect(resolveIndefiniteBillingAccessAction({ annualSubscriptionActive: true, currentGraces: [] })).toBe(
      "excluded-valid-annual",
    )
  })

  it("revoga grants ativos de uma assinatura anual válida", () => {
    expect(resolveIndefiniteBillingAccessAction({ annualSubscriptionActive: true, currentGraces: [{ expiresAt: null }] })).toBe(
      "revoke-annual-grace",
    )
  })

  it("cria grant apenas quando não há assinatura anual válida", () => {
    expect(resolveIndefiniteBillingAccessAction({ annualSubscriptionActive: false, currentGraces: [] })).toBe(
      "grant-indefinite",
    )
  })

  it("mantém grant indefinido idempotente", () => {
    expect(resolveIndefiniteBillingAccessAction({ annualSubscriptionActive: false, currentGraces: [{ expiresAt: null }] })).toBe(
      "already-indefinite",
    )
  })
})
