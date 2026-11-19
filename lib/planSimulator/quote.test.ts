import { describe, expect, it } from "bun:test"
import { EMPTY_FILTERS } from "./planSimulator"
import { buildShareSnapshot, newShareToken, quoteStateSchema, summarizeQuote, QUOTE_LIMITS } from "./quote"

const lives = [2, 0, 0, 0, 0, 0, 0, 0, 0, 1]

describe("summarizeQuote", () => {
  it("usa o menor total entre os planos incluídos e ignora os sem preço", () => {
    const summary = summarizeQuote(
      [
        { chave: "a", precos: { "00-18": 100, "59-199": 300 } },
        { chave: "b", precos: { "00-18": 50, "59-199": 500 } },
        { chave: "sem", precos: { "00-18": 10 } },
      ],
      lives,
    )
    expect(summary).toEqual({ min: 500, nops: 2, vidas: 3 })
  })

  it("sem planos válidos devolve min nulo", () => {
    expect(summarizeQuote([], lives)).toEqual({ min: null, nops: 0, vidas: 3 })
  })
})

describe("newShareToken", () => {
  it("gera tokens de 32 caracteres base64url e distintos", () => {
    const a = newShareToken()
    const b = newShareToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(a).not.toBe(b)
  })
})

describe("buildShareSnapshot", () => {
  it("ordena por total, limita o nome e carimba a data", () => {
    const snap = buildShareSnapshot({
      nome: "x".repeat(200),
      uf: "SP",
      lives,
      filters: EMPTY_FILTERS,
      now: new Date("2026-11-19T10:00:00.000Z"),
      plans: [
        { chave: "caro", operadora: "A", logoPath: "/a", plano: "P", tabela: "T", acomodacao: "Apartamento", contratacao: "Livre", coparticipacao: "Sem", total: 900, regras: [], rede: { hospitais: [], laboratorios: [] } },
        { chave: "barato", operadora: "B", logoPath: "/b", plano: "P", tabela: "T", acomodacao: "Apartamento", contratacao: "Livre", coparticipacao: "Sem", total: 200, regras: [], rede: { hospitais: [], laboratorios: [] } },
      ],
    })
    expect(snap.nome).toHaveLength(QUOTE_LIMITS.maxNome)
    expect(snap.geradoEm).toBe("2026-11-19T10:00:00.000Z")
    expect(snap.plans.map((p) => p.chave)).toEqual(["barato", "caro"])
  })
})

describe("quoteStateSchema", () => {
  const valid = { lives, uf: "SP", filters: EMPTY_FILTERS, sel: ["abc"] }

  it("aceita estado válido", () => {
    expect(quoteStateSchema.safeParse(valid).success).toBe(true)
  })

  it("recusa faixa a mais, UF inválida e excesso de planos", () => {
    expect(quoteStateSchema.safeParse({ ...valid, lives: [1, 2] }).success).toBe(false)
    expect(quoteStateSchema.safeParse({ ...valid, uf: "SPA" }).success).toBe(false)
    const tooMany = Array.from({ length: QUOTE_LIMITS.maxSelected + 1 }, (_, i) => `c${i}`)
    expect(quoteStateSchema.safeParse({ ...valid, sel: tooMany }).success).toBe(false)
  })
})
