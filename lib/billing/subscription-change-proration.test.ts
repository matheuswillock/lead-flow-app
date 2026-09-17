import { describe, expect, it } from "bun:test"
import { calculateSubscriptionChangeProration } from "./subscription-change-proration"

describe("calculateSubscriptionChangeProration", () => {
  it("cobra a diferença de custo diário do alvo pelos dias restantes, líquida do crédito do plano atual", () => {
    const now = new Date("2026-09-01T00:00:00.000Z")
    const currentPeriodEnd = new Date("2026-09-16T00:00:00.000Z") // 15 dias restantes

    const result = calculateSubscriptionChangeProration({
      currentChargedAmount: 79.9, // plano mensal atual
      currentCycle: "monthly", // 30 dias
      currentPeriodEnd,
      targetListAmount: 300, // plano trimestral alvo (90 dias)
      targetCycle: "quarterly",
      now,
    })

    // crédito do atual: 79.9 * (15/30) = 39.95
    // custo do alvo pelos 15 dias: (300/90) * 15 = 50
    // prorata = 50 - 39.95 = 10.05
    expect(result).toBe(10.05)
  })

  it("nunca cobra negativo (downgrade não gera crédito nesta fase)", () => {
    const now = new Date("2026-09-01T00:00:00.000Z")
    const currentPeriodEnd = new Date("2026-09-16T00:00:00.000Z")

    const result = calculateSubscriptionChangeProration({
      currentChargedAmount: 1000,
      currentCycle: "monthly",
      currentPeriodEnd,
      targetListAmount: 10,
      targetCycle: "monthly",
      now,
    })

    expect(result).toBe(0)
  })

  it("sem assinatura atual (currentCycle/currentPeriodEnd nulos) → cobra o valor de tabela cheio", () => {
    const result = calculateSubscriptionChangeProration({
      currentChargedAmount: 0,
      currentCycle: null,
      currentPeriodEnd: null,
      targetListAmount: 274.2,
      targetCycle: "quarterly",
      now: new Date("2026-09-01T00:00:00.000Z"),
    })

    expect(result).toBe(274.2)
  })

  it("período atual já vencido (remainingMs <= 0) → cobra o valor de tabela cheio", () => {
    const result = calculateSubscriptionChangeProration({
      currentChargedAmount: 79.9,
      currentCycle: "monthly",
      currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      targetListAmount: 300,
      targetCycle: "quarterly",
      now: new Date("2026-09-01T00:00:00.000Z"),
    })

    expect(result).toBe(300)
  })

  it("dias restantes maiores que o ciclo atual são clampados ao próprio ciclo", () => {
    const now = new Date("2026-09-01T00:00:00.000Z")
    // currentPeriodEnd 400 dias no futuro, mas o ciclo é mensal (30 dias) — clampa em 30
    const currentPeriodEnd = new Date("2027-10-06T00:00:00.000Z")

    const result = calculateSubscriptionChangeProration({
      currentChargedAmount: 79.9,
      currentCycle: "monthly",
      currentPeriodEnd,
      targetListAmount: 300,
      targetCycle: "quarterly",
      now,
    })

    // crédito: 79.9 * (30/30) = 79.9; custo alvo: (300/90)*30 = 100; prorata = 20.1
    expect(result).toBe(20.1)
  })
})
