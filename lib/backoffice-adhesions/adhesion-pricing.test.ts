import { describe, expect, it } from "bun:test"
import type { BackofficeProduct, BackofficeProductPaymentRule } from "@prisma/client"
import {
  BACKOFFICE_ADHESION_CYCLE_LABELS,
  BACKOFFICE_ADHESION_CYCLE_MONTHS,
  calculateBackofficeAdhesionPricing,
  resolveCardMonthlyPriceFromRule,
  resolveProductPriceForCycle,
  resolveProductPriceForCycleOrNull,
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

describe("ciclo quadrimestral (4 meses) — precificação CRM - RADAR - GERENCIADO", () => {
  const quadrimester = "quadrimester" as keyof typeof BACKOFFICE_ADHESION_CYCLE_MONTHS

  it("quadrimester vale 4 meses e tem label Quadrimestral", () => {
    expect(BACKOFFICE_ADHESION_CYCLE_MONTHS[quadrimester]).toBe(4)
    expect(BACKOFFICE_ADHESION_CYCLE_LABELS[quadrimester]).toBe("Quadrimestral")
  })

  it("resolveProductPriceForCycle lê priceQuadrimester no ciclo quadrimester", () => {
    const product = {
      name: "CRM - RADAR - GERENCIADO",
      priceMonthly: null,
      priceQuarterly: null,
      priceQuadrimester: { toString: () => "2500" },
      priceSemiannual: null,
      priceAnnual: null,
    } as unknown as BackofficeProduct
    expect(resolveProductPriceForCycle(product, quadrimester as never)).toBe(2500)
  })

  it("EQUAL 2500/mês em quadrimester → cobrança única de R$ 10.000 nos dois métodos; cartão em até 4x", () => {
    const rules = [
      {
        paymentMethod: "PIX",
        billingCycle: quadrimester,
        price: { toString: () => "2500" },
        installmentSplitMode: "EQUAL",
        canInstallment: false,
        maxInstallments: 1,
      },
      {
        paymentMethod: "CREDIT_CARD",
        billingCycle: quadrimester,
        price: { toString: () => "2500" },
        installmentSplitMode: "EQUAL",
        canInstallment: true,
        maxInstallments: 4,
      },
    ] as unknown as BackofficeProductPaymentRule[]

    const pricing = calculateBackofficeAdhesionPricing(
      { cycle: quadrimester as never, extraTeams: 0, extraUsers: 0 },
      { baseMonthlyPrice: 2500, extraTeamPrice: 0, extraUserPrice: 0 },
      rules
    )

    expect(pricing.cycleMonths).toBe(4)
    expect(pricing.pixTotalAmount).toBe(10000)
    expect(pricing.creditCardTotalAmount).toBe(10000)
    expect(pricing.totalAmount).toBe(10000)
    expect(pricing.pixTotalAmount).toBe(pricing.creditCardTotalAmount)
    expect(pricing.maxCardInstallments).toBe(4)
  })

  it("resolveProductPriceForCycleOrNull devolve null (sem lançar) quando o produto não tem preço no ciclo", () => {
    const crmDefault = {
      name: "CRM",
      priceMonthly: { toString: () => "79.9" },
      priceQuarterly: { toString: () => "219" },
      priceQuadrimester: null,
      priceSemiannual: { toString: () => "399" },
      priceAnnual: { toString: () => "719" },
    } as unknown as BackofficeProduct

    expect(resolveProductPriceForCycleOrNull(crmDefault, quadrimester as never)).toBeNull()
    expect(resolveProductPriceForCycleOrNull(crmDefault, "monthly")).toBe(79.9)
    // a versão estrita continua lançando — comportamento preservado
    expect(() => resolveProductPriceForCycle(crmDefault, quadrimester as never)).toThrow()
  })
})
