import { describe, expect, it, mock } from "bun:test"
import { resolveCreditUnitPrice, resolveExtraUnitPrice } from "./subscription-billing-breakdown"

/**
 * A fonte da verdade dos números abaixo é `buildBillingSummary`
 * (`app/api/shared/billing/billingSummary.ts`):
 *   billableTeams   = Math.max(rawExtraTeams, contractedExtraTeams)
 *   extraTeamsPrice = billableTeams * 29.90
 */
describe("resolveExtraUnitPrice (T-21.12)", () => {
  it("quantidade faturável + preço total presente → taxa unitária real do backend", () => {
    const price = resolveExtraUnitPrice({ billableQuantity: 2, extraPrice: 59.8, fallback: 29.9 })
    expect(price).toBeCloseTo(29.9, 10)
    expect(Number.isFinite(price)).toBe(true)
  })

  it("uso real acima do contratado: 2 faturáveis / 1 contratado → R$ 29,90, nunca R$ 59,80 (achado P1 do Codex, PR #1199)", () => {
    // Cenário exato do review: contractedExtraTeams=1, rawExtraTeams=2 →
    // billableTeams=2 e extraTeamsPrice=59.80. Dividir por contractedExtra (1)
    // daria 59.80/unidade — o dobro da taxa que o Asaas cobra. Dividir pela
    // faturável (2) devolve 29.90, que é a taxa real.
    const price = resolveExtraUnitPrice({ billableQuantity: 2, extraPrice: 59.8, fallback: 29.9 })
    expect(price).toBeCloseTo(29.9, 10)
    expect(price).not.toBeCloseTo(59.8, 2)
  })

  it("créditos comprados e não usados: billable = contratado, taxa continua correta e finita", () => {
    // contractedExtraTeams=2, rawExtraTeams=0 → billableTeams=max(0,2)=2.
    const price = resolveExtraUnitPrice({ billableQuantity: 2, extraPrice: 59.8, fallback: 29.9 })
    expect(price).toBeCloseTo(29.9, 10)
    expect(price).not.toBe(Infinity)
  })

  it("regressão 'R$ ∞': quantidade faturável 0 cai no fallback, nunca divide por zero", () => {
    const onFallback = mock(() => {})
    const price = resolveExtraUnitPrice({ billableQuantity: 0, extraPrice: 59.8, fallback: 29.9, onFallback })
    expect(price).toBe(29.9)
    expect(Number.isFinite(price)).toBe(true)
    expect(price).not.toBe(Infinity)
    expect(onFallback).toHaveBeenCalledTimes(1)
  })

  it("backend sem preço → fallback E loga (dado genuinamente faltando)", () => {
    const onFallback = mock(() => {})
    const price = resolveExtraUnitPrice({ billableQuantity: 3, extraPrice: undefined, fallback: 29.9, onFallback })
    expect(price).toBe(29.9)
    expect(onFallback).toHaveBeenCalledWith(29.9)
  })

  it("extraPrice não finito (NaN/Infinity do backend) cai no fallback logado, nunca propaga", () => {
    const onFallback = mock(() => {})
    const price = resolveExtraUnitPrice({ billableQuantity: 2, extraPrice: Number.NaN, fallback: 19.9, onFallback })
    expect(price).toBe(19.9)
    expect(onFallback).toHaveBeenCalledTimes(1)
  })
})

describe("resolveCreditUnitPrice (T-21.13 / DA4)", () => {
  it("usa a taxa marginal derivada da quantidade faturável", () => {
    const price = resolveCreditUnitPrice({ resource: "team", billableQuantity: 2, extraPrice: 59.8 })
    expect(price).toBeCloseTo(29.9, 10)
  })

  it("estimativa de compra nova não infla quando o uso passa do contratado (P1 do Codex)", () => {
    // 3 times faturáveis, extraTeamsPrice=89.70 → marginal correta = 29.90.
    const price = resolveCreditUnitPrice({ resource: "team", billableQuantity: 3, extraPrice: 89.7 })
    expect(price).toBeCloseTo(29.9, 10)
  })

  it("sem quantidade faturável → fallback logado (não há taxa do backend para derivar)", () => {
    const onFallback = mock(() => {})
    const price = resolveCreditUnitPrice({ resource: "team", billableQuantity: 0, extraPrice: undefined, onFallback })
    expect(price).toBe(29.9)
    expect(onFallback).toHaveBeenCalledWith("team", 29.9)
  })

  it("resource 'user' usa o fallback de usuário (19.9), não o de time", () => {
    const onFallback = mock(() => {})
    const price = resolveCreditUnitPrice({ resource: "user", billableQuantity: 0, extraPrice: undefined, onFallback })
    expect(price).toBe(19.9)
    expect(onFallback).toHaveBeenCalledWith("user", 19.9)
  })
})
