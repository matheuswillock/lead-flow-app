import { describe, expect, it } from "bun:test"
import type { SelfCheckoutCycleOption } from "@/lib/self-checkout/contracts"
import { cyclePriceFor, savingsPercentVsMonthly } from "./SelfCheckoutCycleSelector"

const withCard: SelfCheckoutCycleOption[] = [
  {
    cycle: "monthly",
    label: "Mensal",
    pixTotal: 102.9,
    monthlyEquivalent: 102.9,
    months: 1,
    creditCardTotal: 110.6,
    creditCardMonthlyEquivalent: 110.6,
    maxInstallments: 1,
  },
  {
    cycle: "annual",
    label: "Anual",
    pixTotal: 958.8,
    monthlyEquivalent: 79.9,
    months: 12,
    creditCardTotal: 1051.2,
    creditCardMonthlyEquivalent: 87.6,
    maxInstallments: 12,
  },
]

describe("cyclePriceFor", () => {
  it("usa os valores do PIX ou do cartão conforme a forma de pagamento escolhida", () => {
    expect(cyclePriceFor(withCard[1], "PIX")).toEqual({ isCard: false, total: 958.8, monthly: 79.9 })
    expect(cyclePriceFor(withCard[1], "CREDIT_CARD")).toEqual({ isCard: true, total: 1051.2, monthly: 87.6 })
  })

  it("cai para o PIX quando o plano não tem cartão", () => {
    const noCard: SelfCheckoutCycleOption = { ...withCard[1], creditCardTotal: undefined }
    expect(cyclePriceFor(noCard, "CREDIT_CARD").isCard).toBe(false)
    expect(cyclePriceFor(noCard, "CREDIT_CARD").total).toBe(958.8)
  })
})

describe("savingsPercentVsMonthly por forma de pagamento", () => {
  it("compara PIX com PIX e cartão com cartão", () => {
    expect(savingsPercentVsMonthly(withCard[1], withCard, "PIX")).toBe(22)
    expect(savingsPercentVsMonthly(withCard[1], withCard, "CREDIT_CARD")).toBe(20)
  })
})

const cycles: SelfCheckoutCycleOption[] = [
  { cycle: "monthly", label: "Mensal", pixTotal: 100, monthlyEquivalent: 100, months: 1 },
  { cycle: "quarterly", label: "Trimestral", pixTotal: 270, monthlyEquivalent: 90, months: 3 },
  { cycle: "annual", label: "Anual", pixTotal: 800, monthlyEquivalent: 66.67, months: 12 },
]

describe("savingsPercentVsMonthly", () => {
  it("calcula a economia contra o plano mensal, arredondando para baixo", () => {
    expect(savingsPercentVsMonthly(cycles[1], cycles)).toBe(10)
    expect(savingsPercentVsMonthly(cycles[2], cycles)).toBe(33)
  })

  it("não mostra economia para o próprio mensal", () => {
    expect(savingsPercentVsMonthly(cycles[0], cycles)).toBeNull()
  })

  it("não mostra economia sem plano mensal na lista ou quando a diferença é menor que 1%", () => {
    expect(savingsPercentVsMonthly(cycles[2], [cycles[1], cycles[2]])).toBeNull()
    const almostSame: SelfCheckoutCycleOption = { ...cycles[1], monthlyEquivalent: 99.5 }
    expect(savingsPercentVsMonthly(almostSame, [cycles[0], almostSame])).toBeNull()
  })
})
