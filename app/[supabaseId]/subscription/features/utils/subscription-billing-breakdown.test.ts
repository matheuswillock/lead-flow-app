import { describe, expect, it, mock } from "bun:test"
import { resolveCreditUnitPrice, resolveExtraUnitPrice } from "./subscription-billing-breakdown"

describe("resolveExtraUnitPrice (T-21.12)", () => {
  it("extras contratados + preço total presente → valor unitário finito", () => {
    const price = resolveExtraUnitPrice({ contractedExtra: 2, extraPrice: 59.8, fallback: 29.9 })
    expect(price).toBe(29.9)
    expect(Number.isFinite(price)).toBe(true)
  })

  it("regressão do bug 'R$ ∞': billableTeams=0 não é mais um insumo do cálculo — extras contratados + extraPrice presente nunca produz Infinity", () => {
    // No bug original a divisão era `extraTeamsPrice / billableTeams`. Aqui
    // simulamos exatamente o cenário do achado (créditos comprados e não
    // usados): 2 times extras contratados, billableTeams seria 0, mas essa
    // função nunca recebe/usa billableTeams — só a quantidade contratada.
    const price = resolveExtraUnitPrice({ contractedExtra: 2, extraPrice: 100, fallback: 29.9 })
    expect(price).toBe(50)
    expect(Number.isFinite(price)).toBe(true)
    expect(price).not.toBe(Infinity)
  })

  it("0 extras contratados → fallback sem logar (não é erro)", () => {
    const onFallback = mock(() => {})
    const price = resolveExtraUnitPrice({ contractedExtra: 0, extraPrice: undefined, fallback: 29.9, onFallback })
    expect(price).toBe(29.9)
    expect(onFallback).not.toHaveBeenCalled()
  })

  it("extras contratados mas backend sem preço → fallback E loga (dado faltando de verdade)", () => {
    const onFallback = mock(() => {})
    const price = resolveExtraUnitPrice({ contractedExtra: 3, extraPrice: undefined, fallback: 29.9, onFallback })
    expect(price).toBe(29.9)
    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(onFallback).toHaveBeenCalledWith(29.9)
  })

  it("extraPrice não finito (NaN/Infinity vindo do backend) cai no fallback logado, nunca propaga NaN/Infinity", () => {
    const onFallback = mock(() => {})
    const price = resolveExtraUnitPrice({ contractedExtra: 2, extraPrice: Number.NaN, fallback: 19.9, onFallback })
    expect(price).toBe(19.9)
    expect(onFallback).toHaveBeenCalledTimes(1)
  })
})

describe("resolveCreditUnitPrice (T-21.13 / DA4)", () => {
  it("usa a taxa derivada do backend (mesma taxa já cobrada pelos créditos contratados)", () => {
    const price = resolveCreditUnitPrice({ resource: "team", contractedExtra: 2, extraPrice: 59.8 })
    expect(price).toBe(29.9)
  })

  it("sem créditos contratados desse tipo → fallback logado (não há taxa do backend para derivar)", () => {
    const onFallback = mock(() => {})
    const price = resolveCreditUnitPrice({ resource: "team", contractedExtra: 0, extraPrice: undefined, onFallback })
    expect(price).toBe(29.9)
    expect(onFallback).toHaveBeenCalledWith("team", 29.9)
  })

  it("resource 'user' usa o fallback de usuário (19.9), não o de time", () => {
    const onFallback = mock(() => {})
    const price = resolveCreditUnitPrice({ resource: "user", contractedExtra: 0, extraPrice: undefined, onFallback })
    expect(price).toBe(19.9)
  })
})
