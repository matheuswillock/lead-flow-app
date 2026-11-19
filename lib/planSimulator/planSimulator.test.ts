import { describe, expect, it } from "bun:test"
import {
  EMPTY_FILTERS,
  isEligibleByLives,
  livesByBandFromAges,
  passesFilters,
  priceFor,
  simulate,
  type CatalogTable,
} from "./planSimulator"

const precos = { "00-18": 100, "19-23": 120, "24-28": 140, "29-33": 160, "34-38": 180, "39-43": 200, "44-48": 220, "49-53": 240, "54-58": 260, "59-199": 300 }

function table(overrides: Partial<CatalogTable> & { chave: string }): CatalogTable {
  return {
    estado: "SP",
    operatorName: "Amil",
    planoId: 1,
    plano: "Plano",
    tabela: "Tabela",
    acomodacao: "Apartamento",
    contratacao: "Livre",
    coparticipacao: "Sem coparticipação",
    aceitaMei: false,
    vidasMin: 1,
    vidasMax: 29,
    precos,
    ...overrides,
  }
}

const noNetwork = new Map<number, Set<number>>()

describe("livesByBandFromAges", () => {
  it("agrupa idades nas faixas e ignora valores inválidos", () => {
    const lives = livesByBandFromAges([0, 18, 19, 59, 199, -1, 200, 3.5])
    expect(lives[0]).toBe(2) // 0 e 18
    expect(lives[1]).toBe(1) // 19
    expect(lives[9]).toBe(2) // 59 e 199
    expect(lives.reduce((a, b) => a + b, 0)).toBe(5)
  })
})

describe("priceFor", () => {
  it("soma preço por faixa vezes vidas", () => {
    const lives = [2, 0, 0, 0, 0, 0, 0, 0, 0, 1]
    expect(priceFor({ precos }, lives)).toBe(2 * 100 + 300)
  })

  it("retorna null quando falta preço para uma faixa usada", () => {
    const { "19-23": _omit, ...sem } = precos
    expect(priceFor({ precos: sem }, [0, 1, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull()
  })

  it("ignora faixa sem vidas mesmo sem preço", () => {
    const { "19-23": _omit, ...sem } = precos
    expect(priceFor({ precos: sem }, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(100)
  })
})

describe("isEligibleByLives", () => {
  it("respeita mínimo e máximo de vidas", () => {
    expect(isEligibleByLives({ vidasMin: 2, vidasMax: 29 }, 1)).toBe(false)
    expect(isEligibleByLives({ vidasMin: 2, vidasMax: 29 }, 2)).toBe(true)
    expect(isEligibleByLives({ vidasMin: 2, vidasMax: 29 }, 30)).toBe(false)
  })
})

describe("passesFilters", () => {
  it("filtra acomodação, MEI e rede hospitalar", () => {
    const t = table({ chave: "a", planoId: 7, aceitaMei: true, acomodacao: "Enfermaria" })
    const network = new Map([[7, new Set([10, 11])]])
    expect(passesFilters(t, { ...EMPTY_FILTERS, acomodacoes: ["Apartamento"] }, network)).toBe(false)
    expect(passesFilters(t, { ...EMPTY_FILTERS, mei: true }, network)).toBe(true)
    expect(passesFilters(t, { ...EMPTY_FILTERS, hospitalIds: [10, 11] }, network)).toBe(true)
    expect(passesFilters(t, { ...EMPTY_FILTERS, hospitalIds: [10, 99] }, network)).toBe(false)
  })
})

describe("simulate", () => {
  const tables = [
    table({ chave: "barato", operatorName: "Amil", vidasMin: 1 }),
    table({ chave: "caro", operatorName: "Bradesco", vidasMin: 1, precos: { ...precos, "00-18": 900 } }),
    table({ chave: "minimo-alto", vidasMin: 5 }),
    table({ chave: "outro-estado", estado: "RJ" }),
    table({ chave: "sem-preco", vidasMin: 1, precos: { "19-23": 120 } }),
  ]
  const lives = livesByBandFromAges([0, 0]) // 2 vidas de 0 a 18 anos

  it("retorna só planos do estado, ordenados por total, sem preço faltando", () => {
    const result = simulate(tables, { uf: "SP", lives, filters: { ...EMPTY_FILTERS, respeitarMinimoVidas: false } }, noNetwork)
    expect(result.rows.map((r) => r.table.chave)).toEqual(["barato", "minimo-alto", "caro"])
    expect(result.rows[0].total).toBe(200)
  })

  it("oculta planos abaixo do mínimo de vidas quando a regra está ativa", () => {
    const result = simulate(tables, { uf: "SP", lives, filters: EMPTY_FILTERS }, noNetwork)
    expect(result.rows.map((r) => r.table.chave)).not.toContain("minimo-alto")
    expect(result.ocultosPorVidas).toBe(1)
  })

  it("aplica faixa de valor mensal total", () => {
    const result = simulate(tables, { uf: "SP", lives, filters: { ...EMPTY_FILTERS, respeitarMinimoVidas: false, valorMax: 500 } }, noNetwork)
    expect(result.rows.map((r) => r.table.chave)).toEqual(["barato", "minimo-alto"])
    expect(result.ocultosPorValor).toBe(1)
  })

  it("sem vidas não retorna nada", () => {
    const result = simulate(tables, { uf: "SP", lives: livesByBandFromAges([]), filters: EMPTY_FILTERS }, noNetwork)
    expect(result.rows).toHaveLength(0)
  })
})
