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

  it("T-M1.2-e — demais taxas seguem ancoradas em sent (só o openRate mudou de base)", () => {
    // Atualizado pela D6: `openRate` passou a `/delivered` e ganhou
    // `openRateOnSent` ao lado; as outras quatro continuam sobre `sent`, porque
    // a decisão foi escopada ao openRate e não vale ampliar por conta própria.
    const rates = buildRates({ ...baseTotals, failed: 50 })

    expect(rates.deliverabilityRate).toBe(safeRate(180, 200))
    expect(rates.openRate).toBe(safeRate(60, 180))
    expect(rates.openRateOnSent).toBe(safeRate(60, 200))
    expect(rates.clickRate).toBe(safeRate(20, 200))
    expect(rates.bounceRate).toBe(safeRate(10, 200))
    expect(rates.complainRate).toBe(safeRate(2, 200))
  })

  it("T-M1.2-f — Agro-sul 10-11/08: 5.031 aceitos e 32.913 falhos viram 86,74%", () => {
    expect(buildRates({ ...baseTotals, sent: 5031, failed: 32913 }).failureRate).toBe(86.74)
  })
})

describe("analytics-rates — denominador do openRate (T-M2.2, D6)", () => {
  const agroSul = {
    ...baseTotals,
    sent: 9741,
    delivered: 8436,
    opened: 2184,
    clicked: 564,
  }

  it("T-M2.2-a — openRate principal usa delivered, alinhado ao painel do Resend", () => {
    // 2.184 / 8.436 — o mesmo cálculo que o Resend mostra.
    expect(buildRates(agroSul).openRate).toBe(25.89)
  })

  it("T-M2.2-b — a base antiga fica exposta em paralelo na transicao", () => {
    // 2.184 / 9.741 — o que o produto exibia antes, para a mudanca ser
    // conferivel em vez de aparecer como salto inexplicado.
    expect(buildRates(agroSul).openRateOnSent).toBe(22.42)
  })

  it("T-M2.2-c — as duas bases convivem e a nova e sempre >= a antiga", () => {
    // `delivered <= sent` sempre, entao a taxa sobre delivered nunca e menor.
    const rates = buildRates(agroSul)
    expect(rates.openRate).toBeGreaterThan(rates.openRateOnSent)
  })

  it("T-M2.2-d — periodo sem entrega nao divide por zero", () => {
    const rates = buildRates({ ...baseTotals, sent: 100, delivered: 0, opened: 0 })
    expect(rates.openRate).toBe(0)
    expect(rates.openRateOnSent).toBe(0)
  })

  it("T-M2.2-e — clickRate NAO muda de base: D6 foi escopada ao openRate", () => {
    expect(buildRates(agroSul).clickRate).toBe(safeRate(564, 9741))
  })
})
