import { describe, expect, it } from "bun:test"
import type { SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import { cardInstallmentAmount, pixSavingsAmount } from "./checkoutPaymentMath"

const annual: SelfCheckoutCycleOption = {
  cycle: "annual",
  label: "Anual",
  pixTotal: 958.8,
  monthlyEquivalent: 79.9,
  months: 12,
  creditCardTotal: 1051.2,
  creditCardMonthlyEquivalent: 87.6,
  maxInstallments: 12,
}

describe("pixSavingsAmount", () => {
  it("é a diferença entre o total no cartão e o total no PIX", () => {
    expect(pixSavingsAmount(annual)).toBe(92.4)
  })

  it("é zero sem preço de cartão ou quando o cartão não é mais caro", () => {
    expect(pixSavingsAmount({ ...annual, creditCardTotal: undefined })).toBe(0)
    expect(pixSavingsAmount({ ...annual, creditCardTotal: 958.8 })).toBe(0)
  })
})

describe("cardInstallmentAmount", () => {
  it("divide o total do cartão pelo máximo de parcelas, em centavos", () => {
    expect(cardInstallmentAmount(annual)).toBe(87.6)
    expect(cardInstallmentAmount({ ...annual, creditCardTotal: 297.3, maxInstallments: 3 })).toBe(99.1)
  })

  it("é nulo quando o plano não tem cartão", () => {
    expect(cardInstallmentAmount({ ...annual, creditCardTotal: undefined })).toBeNull()
  })
})
