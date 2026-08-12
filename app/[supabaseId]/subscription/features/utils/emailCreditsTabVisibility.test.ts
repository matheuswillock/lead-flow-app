import { describe, expect, it } from "bun:test"
import {
  resolveCheckoutNavigationPath,
  shouldShowEmailCreditsPurchasePlans,
  shouldShowEmailCreditsTab,
  shouldShowEmailCreditsTeamSelector,
} from "./emailCreditsTabVisibility"
import {
  EMAIL_CREDIT_PLAN_CATALOG,
  getEmailCreditPlanLabel,
} from "./emailCreditPlansCatalog"

describe("Email credits tab visibility (Ticket 6 T01–T07)", () => {
  it("T01: feature e-mail em beta e usuário fora do Grupo Beta Radar → aba não aparece", () => {
    expect(
      shouldShowEmailCreditsTab({
        isEmailFeatureBeta: true,
        hasRadarBetaAccess: false,
        canManageSubscription: true,
      })
    ).toBe(false)
  })

  it("T02: feature e-mail em beta e usuário no Grupo Beta Radar → aba aparece", () => {
    expect(
      shouldShowEmailCreditsTab({
        isEmailFeatureBeta: true,
        hasRadarBetaAccess: true,
        canManageSubscription: true,
      })
    ).toBe(true)
  })

  it("T03: feature fora de beta e manager ativo → aba aparece", () => {
    expect(
      shouldShowEmailCreditsTab({
        isEmailFeatureBeta: false,
        hasRadarBetaAccess: false,
        canManageSubscription: true,
      })
    ).toBe(true)
  })

  it("T03b: fora de beta sem permissão de gestão → aba não aparece", () => {
    expect(
      shouldShowEmailCreditsTab({
        isEmailFeatureBeta: false,
        hasRadarBetaAccess: true,
        canManageSubscription: false,
      })
    ).toBe(false)
  })

  it("T04: Master com vários times → mostra seletor de time", () => {
    expect(
      shouldShowEmailCreditsTeamSelector({
        isMaster: true,
        teamCount: 3,
      })
    ).toBe(true)
  })

  it("T04b: Master com um time → não mostra seletor", () => {
    expect(
      shouldShowEmailCreditsTeamSelector({
        isMaster: true,
        teamCount: 1,
      })
    ).toBe(false)
  })

  it("T05: checkoutUrl relativo ou absoluto resolve path /addon-checkout/[id]", () => {
    expect(resolveCheckoutNavigationPath("/addon-checkout/abc-123")).toBe(
      "/addon-checkout/abc-123"
    )
    expect(
      resolveCheckoutNavigationPath("https://app.example.com/addon-checkout/abc-123?x=1")
    ).toBe("/addon-checkout/abc-123?x=1")
  })

  it("T06: status beta gratuito → não pede compra", () => {
    expect(shouldShowEmailCreditsPurchasePlans({ isBetaExempt: true })).toBe(false)
  })

  it("T07: beta cobrado (sem isenção) → mostra planos/compra", () => {
    expect(shouldShowEmailCreditsPurchasePlans({ isBetaExempt: false })).toBe(true)
  })

  it("catálogo canônico inclui Upgrade e Business 50k/R$650", () => {
    expect(EMAIL_CREDIT_PLAN_CATALOG).toHaveLength(5)
    const upgrade = EMAIL_CREDIT_PLAN_CATALOG.find((p) => p.id === "upgrade")
    const business = EMAIL_CREDIT_PLAN_CATALOG.find((p) => p.id === "business")
    expect(upgrade).toEqual({
      id: "upgrade",
      label: "Upgrade",
      credits: 25_000,
      price: 375,
    })
    expect(business).toEqual({
      id: "business",
      label: "Business",
      credits: 50_000,
      price: 650,
    })
    expect(getEmailCreditPlanLabel("plus")).toBe("Plus")
  })
})
