import { describe, expect, it } from "bun:test"
import { FORM_RANKING_MIN_VIEWS, rankTopFormsByConversion } from "./form-ranking"

describe("rankTopFormsByConversion", () => {
  it("retorna top 3 por taxa de conversão", () => {
    const ranked = rankTopFormsByConversion([
      { formId: "1", name: "Baixo", viewed: 100, completed: 10 },
      { formId: "2", name: "Alto", viewed: 100, completed: 50 },
      { formId: "3", name: "Médio", viewed: 100, completed: 30 },
      { formId: "4", name: "Quase", viewed: 100, completed: 40 },
    ])

    expect(ranked.map((r) => r.formId)).toEqual(["2", "4", "3"])
    expect(ranked[0].conversionRate).toBe(50)
    expect(ranked[0].rank).toBe(1)
  })

  it("empate de taxa: desempata por conclusões, depois nome", () => {
    const ranked = rankTopFormsByConversion([
      { formId: "a", name: "Zebra", viewed: 100, completed: 50 },
      { formId: "b", name: "Alpha", viewed: 200, completed: 100 },
      { formId: "c", name: "Beta", viewed: 100, completed: 50 },
    ])

    expect(ranked.map((r) => r.formId)).toEqual(["b", "c", "a"])
    expect(ranked.every((r) => r.conversionRate === 50)).toBe(true)
  })

  it("exclui formulário sem visualizações suficientes", () => {
    const ranked = rankTopFormsByConversion([
      { formId: "ok", name: "Com views", viewed: FORM_RANKING_MIN_VIEWS, completed: 5 },
      { formId: "tiny", name: "Uma view", viewed: 1, completed: 1 },
      { formId: "empty", name: "Sem views", viewed: 0, completed: 0 },
    ])

    expect(ranked).toHaveLength(1)
    expect(ranked[0].formId).toBe("ok")
    expect(ranked[0].conversionRate).toBe(50)
  })

  it("retorna menos de 3 quando há poucos elegíveis", () => {
    const ranked = rankTopFormsByConversion([
      { formId: "1", name: "Único", viewed: FORM_RANKING_MIN_VIEWS, completed: 2 },
    ])
    expect(ranked).toHaveLength(1)
  })

  it("lista vazia quando ninguém tem dados suficientes", () => {
    expect(
      rankTopFormsByConversion([{ formId: "x", name: "Vazio", viewed: 0, completed: 0 }]),
    ).toEqual([])
  })
})
