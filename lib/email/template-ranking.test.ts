import { describe, expect, it } from "bun:test"
import {
  aggregateTemplateGroups,
  rankTopTemplates,
  TEMPLATE_RANKING_MIN_SENT,
} from "./template-ranking"

describe("aggregateTemplateGroups", () => {
  it("soma métricas de todas as versões do mesmo versionGroupId", () => {
    const aggregated = aggregateTemplateGroups([
      {
        versionGroupId: "g1",
        templateId: "v1",
        name: "A v1",
        sent: 100,
        delivered: 90,
        opened: 40,
        clicked: 10,
        bounced: 5,
        complained: 0,
      },
      {
        versionGroupId: "g1",
        templateId: "v2",
        name: "A v2",
        sent: 50,
        delivered: 45,
        opened: 20,
        clicked: 5,
        bounced: 2,
        complained: 1,
      },
      {
        versionGroupId: "g2",
        templateId: "b1",
        name: "B",
        sent: 10,
        delivered: 10,
        opened: 1,
        clicked: 0,
        bounced: 0,
        complained: 0,
      },
    ])

    expect(aggregated).toHaveLength(2)
    const g1 = aggregated.find((row) => row.versionGroupId === "g1")!
    expect(g1.sent).toBe(150)
    expect(g1.opened).toBe(60)
    expect(g1.clicked).toBe(15)
    expect(g1.name).toBe("A v2")
    expect(g1.templateId).toBe("v2")
  })
})

describe("rankTopTemplates", () => {
  const base = {
    delivered: 0,
    bounced: 0,
    complained: 0,
  }

  it("retorna top 3 por abertura e por clique", () => {
    const result = rankTopTemplates([
      { versionGroupId: "1", templateId: "1", name: "Baixo", sent: 100, opened: 10, clicked: 1, ...base },
      { versionGroupId: "2", templateId: "2", name: "Alto open", sent: 100, opened: 50, clicked: 2, ...base },
      { versionGroupId: "3", templateId: "3", name: "Alto click", sent: 100, opened: 20, clicked: 30, ...base },
      { versionGroupId: "4", templateId: "4", name: "Médio", sent: 100, opened: 30, clicked: 10, ...base },
    ])

    expect(result.byOpenRate.map((r) => r.versionGroupId)).toEqual(["2", "4", "3"])
    expect(result.byOpenRate[0].rates.openRate).toBe(50)
    expect(result.byClickRate.map((r) => r.versionGroupId)).toEqual(["3", "4", "2"])
    expect(result.byClickRate[0].rates.clickRate).toBe(30)
  })

  it("empate de taxa: desempata por volume absoluto, depois nome", () => {
    const result = rankTopTemplates([
      { versionGroupId: "a", templateId: "a", name: "Zebra", sent: 100, opened: 50, clicked: 0, ...base },
      { versionGroupId: "b", templateId: "b", name: "Alpha", sent: 200, opened: 100, clicked: 0, ...base },
      { versionGroupId: "c", templateId: "c", name: "Beta", sent: 100, opened: 50, clicked: 0, ...base },
    ])

    // Todos com openRate 50; b tem mais opened (100), depois Alpha < Beta < Zebra
    expect(result.byOpenRate.map((r) => r.versionGroupId)).toEqual(["b", "c", "a"])
    expect(result.byOpenRate.every((r) => r.rates.openRate === 50)).toBe(true)
  })

  it("exclui template sem dados suficientes (sent < mínimo)", () => {
    const result = rankTopTemplates([
      {
        versionGroupId: "ok",
        templateId: "ok",
        name: "Com envios",
        sent: TEMPLATE_RANKING_MIN_SENT,
        opened: 1,
        clicked: 0,
        ...base,
      },
      {
        versionGroupId: "empty",
        templateId: "empty",
        name: "Sem envios",
        sent: 0,
        opened: 0,
        clicked: 0,
        ...base,
      },
    ])

    expect(result.byOpenRate).toHaveLength(1)
    expect(result.byOpenRate[0].versionGroupId).toBe("ok")
    expect(result.byClickRate).toHaveLength(1)
  })

  it("retorna menos de 3 quando há poucos elegíveis", () => {
    const result = rankTopTemplates([
      { versionGroupId: "1", templateId: "1", name: "Só um", sent: 10, opened: 5, clicked: 1, ...base },
    ])

    expect(result.byOpenRate).toHaveLength(1)
    expect(result.byClickRate).toHaveLength(1)
    expect(result.byOpenRate[0].rank).toBe(1)
  })

  it("lista vazia quando ninguém tem dados suficientes", () => {
    const result = rankTopTemplates([
      { versionGroupId: "x", templateId: "x", name: "Vazio", sent: 0, opened: 0, clicked: 0, ...base },
    ])
    expect(result.byOpenRate).toEqual([])
    expect(result.byClickRate).toEqual([])
  })
})
