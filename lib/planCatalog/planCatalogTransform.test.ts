import { describe, expect, it } from "bun:test"
import { planCatalogFixture } from "./planCatalog.fixture"
import { planCatalogFileSchema } from "./planCatalogSchema"
import { planOperatorLogoPath, transformPlanCatalog } from "./planCatalogTransform"

describe("transformPlanCatalog", () => {
  it("transforma uma base válida sem inconsistências", () => {
    const { rows, issues } = transformPlanCatalog(planCatalogFixture())
    expect(issues).toEqual([])
    expect(rows.tables).toHaveLength(1)
    expect(rows.tables[0].operatorName).toBe("SulAmérica")
    expect(rows.operators).toEqual([{ name: "SulAmérica", logoPath: "/operadoras/sulamerica.svg" }])
    expect(rows.networkEntries).toEqual([
      { planoId: 100, providerId: 7, kind: "HOSPITAL", atendimento: ["H", "PS"] },
      { planoId: 100, providerId: 7, kind: "LAB", atendimento: [] },
    ])
  })

  it("aponta preço ausente para uma faixa", () => {
    const file = planCatalogFixture()
    delete file.planos[0].precos["19-23"]
    const { issues } = transformPlanCatalog(file)
    expect(issues.some((i) => i.includes("preço sem faixa 19-23"))).toBe(true)
  })

  it("aponta regra que referencia texto inexistente", () => {
    const file = planCatalogFixture()
    file.planos[0].regras = { Carências: "nao-existe" }
    const { issues } = transformPlanCatalog(file)
    expect(issues.some((i) => i.includes("texto inexistente nao-existe"))).toBe(true)
  })

  it("aponta credenciado órfão na rede", () => {
    const file = planCatalogFixture()
    file.rede["100"].laboratorios = [999]
    const { issues } = transformPlanCatalog(file)
    expect(issues.some((i) => i.includes("laboratório sem credenciado 999"))).toBe(true)
  })

  it("aponta sigla de atendimento desconhecida", () => {
    const file = planCatalogFixture()
    file.rede["100"].hospitais = [[7, "H,XYZ"]]
    const { issues } = transformPlanCatalog(file)
    expect(issues.some((i) => i.includes("sigla de atendimento desconhecida XYZ"))).toBe(true)
  })

  it("aponta chave duplicada e estado sem cadastro", () => {
    const file = planCatalogFixture()
    file.planos.push({ ...file.planos[0], estado: "ZZ" })
    const { issues } = transformPlanCatalog(file)
    expect(issues.some((i) => i.includes("chave duplicada: abc123"))).toBe(true)
    expect(issues.some((i) => i.includes("estado sem cadastro"))).toBe(true)
  })
})

describe("planCatalogFileSchema", () => {
  it("recusa campo obrigatório ausente", () => {
    const file = planCatalogFixture() as unknown as Record<string, unknown>
    delete file.textos
    expect(planCatalogFileSchema.safeParse(file).success).toBe(false)
  })
})

describe("planOperatorLogoPath", () => {
  it("normaliza acento e espaço no nome do arquivo", () => {
    expect(planOperatorLogoPath("Porto Seguro")).toBe("/operadoras/porto-seguro.svg")
    expect(planOperatorLogoPath("Hapvida NotreDame")).toBe("/operadoras/hapvida-notredame.svg")
  })
})
