import { describe, expect, it } from "bun:test"

import { buildRates, safeRate } from "@/lib/email/analytics-rates"

const baseTotals = {
  sent: 200,
  delivered: 180,
  opened: 60,
  clicked: 20,
  bounced: 10,
  complained: 2,
}

describe("analytics-rates — failureRate (T-M1.2)", () => {
  it("T-M1.2-a — failureRate usa failed/(sent+failed), não failed/sent", () => {
    // Incêndio de quota: 30 saíram, 70 morreram antes de sair.
    const rates = buildRates({ ...baseTotals, sent: 30, failed: 70 })

    expect(rates.failureRate).toBe(70)
  })

  it("T-M1.2-b — sem falha no período a taxa é zero", () => {
    expect(buildRates({ ...baseTotals, failed: 0 }).failureRate).toBe(0)
  })

  it("T-M1.2-c — período sem envio nem falha não divide por zero", () => {
    expect(buildRates({ ...baseTotals, sent: 0, failed: 0 }).failureRate).toBe(0)
  })

  it("T-M1.2-d — disparo sem contador de falha reporta 0, não NaN", () => {
    expect(buildRates(baseTotals).failureRate).toBe(0)
  })

  it("T-M1.2-e — taxas existentes seguem ancoradas em sent", () => {
    const rates = buildRates({ ...baseTotals, failed: 50 })

    expect(rates.deliverabilityRate).toBe(safeRate(180, 200))
    expect(rates.openRate).toBe(safeRate(60, 200))
    expect(rates.clickRate).toBe(safeRate(20, 200))
    expect(rates.bounceRate).toBe(safeRate(10, 200))
    expect(rates.complainRate).toBe(safeRate(2, 200))
  })

  it("T-M1.2-f — Agro-sul 10-11/08: 5.031 aceitos e 32.913 falhos viram 86,74%", () => {
    expect(buildRates({ ...baseTotals, sent: 5031, failed: 32913 }).failureRate).toBe(86.74)
  })
})
