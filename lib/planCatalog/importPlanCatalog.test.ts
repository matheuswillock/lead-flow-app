import { describe, expect, it } from "bun:test"
import { planCatalogFixture } from "./planCatalog.fixture"
import { importPlanCatalog, type IPlanCatalogRepository, type PlanCatalogImportMeta } from "./importPlanCatalog"
import type { PlanCatalogRows } from "./planCatalogTransform"

function fakeRepo() {
  const calls: { rows: PlanCatalogRows; meta: PlanCatalogImportMeta }[] = []
  const repo: IPlanCatalogRepository = {
    async replaceCatalog(rows, meta) {
      calls.push({ rows, meta })
    },
  }
  return { repo, calls }
}

describe("importPlanCatalog", () => {
  it("grava uma vez com contagens e metadados", async () => {
    const { repo, calls } = fakeRepo()
    const result = await importPlanCatalog(planCatalogFixture(), repo, { source: "base.json", dryRun: false })

    expect(result).toEqual({
      ok: true,
      counts: { operators: 1, tables: 1, ruleTexts: 1, providers: 1, networkEntries: 2 },
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].meta.source).toBe("base.json")
    expect(calls[0].meta.generatedAt.toISOString()).toBe("2026-11-07T23:11:38.617Z")
  })

  it("dry-run valida sem gravar", async () => {
    const { repo, calls } = fakeRepo()
    const result = await importPlanCatalog(planCatalogFixture(), repo, { source: "base.json", dryRun: true })
    expect(result.ok).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it("não grava nada quando há inconsistência", async () => {
    const { repo, calls } = fakeRepo()
    const file = planCatalogFixture()
    file.planos[0].regras = { Carências: "inexistente" }

    const result = await importPlanCatalog(file, repo, { source: "base.json", dryRun: false })
    expect(result.ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it("não grava nada quando o arquivo não tem a forma esperada", async () => {
    const { repo, calls } = fakeRepo()
    const result = await importPlanCatalog({ sobre: {} }, repo, { source: "base.json", dryRun: false })
    expect(result.ok).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it("reimportar a mesma base produz o mesmo resultado", async () => {
    const { repo } = fakeRepo()
    const a = await importPlanCatalog(planCatalogFixture(), repo, { source: "base.json", dryRun: true })
    const b = await importPlanCatalog(planCatalogFixture(), repo, { source: "base.json", dryRun: true })
    expect(a).toEqual(b)
  })
})
