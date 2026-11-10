import { describe, expect, it } from "bun:test"
import type { PublicAdhesionDetails } from "../context/PublicAdhesionTypes"
import {
  buildAdhesionPaymentSummary,
  installmentAmounts,
  maxInstallmentsFor,
  toCents,
} from "./adhesionPayment"

const details = {
  cycleMonths: 12,
  totalAmount: 958.8,
  pixTotalAmount: 988.7,
  creditCardTotalAmount: 1190.82,
  maxCardInstallments: 12,
  maxInstallments: 12,
  installmentSplitMode: "EQUAL",
  installmentSchedule: [],
  extrasTotalAmount: 29.9,
} as unknown as PublicAdhesionDetails

describe("buildAdhesionPaymentSummary", () => {
  it("separa plano e adicionais e calcula o equivalente mensal", () => {
    const pix = buildAdhesionPaymentSummary(details, "PIX")
    expect(pix.total).toBe(988.7)
    expect(pix.extrasTotal).toBe(29.9)
    expect(pix.planTotal).toBe(958.8)
    expect(pix.monthlyEquivalent).toBe(82.39)
    expect(pix.pixSavings).toBe(202.12)
  })

  it("no cartão usa o total do cartão, com os mesmos adicionais", () => {
    const card = buildAdhesionPaymentSummary(details, "CREDIT_CARD")
    expect(card.total).toBe(1190.82)
    expect(card.planTotal).toBe(1160.92)
  })

  it("sem adicionais (adesão administrativa) o plano é o total", () => {
    const summary = buildAdhesionPaymentSummary({ ...details, extrasTotalAmount: null }, "PIX")
    expect(summary.extrasTotal).toBe(0)
    expect(summary.planTotal).toBe(988.7)
  })
})

describe("maxInstallmentsFor", () => {
  it("usa o máximo do produto, limitado a 12", () => {
    expect(maxInstallmentsFor(details)).toBe(12)
    expect(maxInstallmentsFor({ ...details, maxCardInstallments: 24 })).toBe(12)
  })

  it("com cronograma fixo, as parcelas são as do cronograma", () => {
    expect(
      maxInstallmentsFor({ ...details, installmentSplitMode: "CUSTOM", installmentSchedule: [500, 500] }),
    ).toBe(2)
  })
})

describe("installmentAmounts", () => {
  it("a soma das parcelas fecha o total", () => {
    const amounts = installmentAmounts(1190.82, 12)
    expect(amounts).toHaveLength(12)
    expect(Math.round(amounts.reduce((sum, value) => sum + value, 0) * 100) / 100).toBe(1190.82)
  })
})

describe("toCents", () => {
  it("converte reais em centavos sem erro de arredondamento", () => {
    expect(toCents(1161.12)).toBe(116112)
    expect(toCents(19.9)).toBe(1990)
  })
})
