import { describe, expect, it } from "bun:test"
import type { BackofficeProductPaymentRule } from "@prisma/client"
import {
  calculateBackofficeAdhesionPricing,
  resolveChargeAmountByMethod,
  resolveEffectiveChargeMethod,
} from "./adhesion-pricing"

const rule = (
  paymentMethod: "PIX" | "CREDIT_CARD",
  price: number,
  maxInstallments: number
): BackofficeProductPaymentRule =>
  ({
    billingCycle: "annual",
    paymentMethod,
    price: { toString: () => String(price) },
    installmentSplitMode: "EQUAL",
    maxInstallments,
  }) as unknown as BackofficeProductPaymentRule

// PIX com desconto frente ao cartão: os campos "genéricos" seguem o cartão.
const pricing = calculateBackofficeAdhesionPricing(
  { cycle: "annual", extraTeams: 0, extraUsers: 0 },
  { baseMonthlyPrice: 100, extraTeamPrice: 0, extraUserPrice: 0 },
  [rule("PIX", 80, 1), rule("CREDIT_CARD", 100, 12)]
)

describe("resolveChargeAmountByMethod", () => {
  it("PIX devolve valores de PIX, à vista, nunca os genéricos (que são de cartão)", () => {
    const pix = resolveChargeAmountByMethod(pricing, "PIX")

    expect(pix).toEqual({ method: "PIX", monthlyAmount: 80, totalAmount: 960, maxInstallments: 1 })
    expect(pix.totalAmount).not.toBe(pricing.totalAmount)
  })

  it("cartão devolve valores e parcelas de cartão", () => {
    const card = resolveChargeAmountByMethod(pricing, "CREDIT_CARD")

    expect(card).toEqual({
      method: "CREDIT_CARD",
      monthlyAmount: 100,
      totalAmount: 1200,
      maxInstallments: 12,
    })
  })
})

describe("resolveEffectiveChargeMethod", () => {
  it("mantém o cartão preferido quando ofertado", () => {
    expect(resolveEffectiveChargeMethod("CREDIT_CARD", ["PIX", "CREDIT_CARD"])).toBe("CREDIT_CARD")
  })
  it("cartão preferido porém desligado cai para PIX", () => {
    expect(resolveEffectiveChargeMethod("CREDIT_CARD", ["PIX"])).toBe("PIX")
  })
  it("sem preferência (EXTERNAL/null) resolve PIX", () => {
    expect(resolveEffectiveChargeMethod(null, ["PIX", "CREDIT_CARD"])).toBe("PIX")
    expect(resolveEffectiveChargeMethod(undefined, ["PIX"])).toBe("PIX")
  })
})
