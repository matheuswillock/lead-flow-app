import { describe, expect, it } from "bun:test"
import { finalScore, formCloseRate, openRate, startRate } from "./metrics"

describe("openRate", () => {
  it("calcula aberturas ÷ enviados", () => {
    expect(openRate(2494, 6739)).toBeCloseTo(0.370085, 5)
  })

  it("divisor zero devolve null, nunca 0 sintético", () => {
    expect(openRate(0, 0)).toBeNull()
  })

  it("numerador zero com denominador positivo devolve 0", () => {
    expect(openRate(0, 100)).toBe(0)
  })
})

describe("finalScore", () => {
  it("calcula leads por 1.000 enviados", () => {
    expect(finalScore(6, 1623)).toBeCloseTo(3.697, 3)
  })

  it("divisor zero devolve null", () => {
    expect(finalScore(5, 0)).toBeNull()
  })

  it("bate com o número congelado do artefato de 31/08 (Liber, finalScore 3,70)", () => {
    expect(Math.round(finalScore(6, 1623)! * 100) / 100).toBe(3.7)
  })

  it("bate com o número congelado do artefato de 31/08 (MultiSkill, finalScore 3,57)", () => {
    expect(Math.round(finalScore(5, 1402)! * 100) / 100).toBe(3.57)
  })

  it("bate com o número congelado do artefato de 31/08 (Backoffice, finalScore 0,35)", () => {
    expect(Math.round(finalScore(5, 14382)! * 100) / 100).toBe(0.35)
  })
})

describe("formCloseRate", () => {
  it("calcula completos ÷ iniciados", () => {
    expect(formCloseRate(10, 12)).toBeCloseTo(0.8333, 4)
  })

  it("divisor zero devolve null, nunca 0 sintético", () => {
    expect(formCloseRate(0, 0)).toBeNull()
  })

  it("form sem completes mas com starts devolve 0 (não null)", () => {
    expect(formCloseRate(0, 5)).toBe(0)
  })
})

describe("startRate", () => {
  it("calcula iniciados ÷ visualizações", () => {
    expect(startRate(12, 67)).toBeCloseTo(0.17910, 4)
  })

  it("divisor zero devolve null, nunca 0 sintético", () => {
    expect(startRate(0, 0)).toBeNull()
  })
})
