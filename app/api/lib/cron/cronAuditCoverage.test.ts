import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

type VercelCron = { path: string; schedule: string }

function readVercelCronPaths(): string[] {
  const raw = readFileSync(join(process.cwd(), "vercel.json"), "utf8")
  const crons = (JSON.parse(raw) as { crons?: VercelCron[] }).crons ?? []
  return [...new Set(crons.map((cron) => cron.path))]
}

function readRouteSource(cronPath: string): string {
  return readFileSync(join(process.cwd(), "app", cronPath, "route.ts"), "utf8")
}

/**
 * Contraparte estática de T-Q5.2: o inventário do `vercel.json` tem que ser o
 * inventário da auditoria. O assert em SQL só fecha depois do deploy; estes
 * garantem que nenhum cron novo nasça cego.
 */
describe("cobertura de auditoria dos crons", () => {
  it("toda rota de cron registrada declara um cronKey", () => {
    const semCronKey = readVercelCronPaths().filter(
      (cronPath) => !/cronKey:\s*"[^"]+"/.test(readRouteSource(cronPath)),
    )

    expect(semCronKey).toEqual([])
  })

  it("toda rota de cron registrada chama withCronAudit", () => {
    const semAuditoria = readVercelCronPaths().filter(
      (cronPath) => !readRouteSource(cronPath).includes("withCronAudit("),
    )

    expect(semAuditoria).toEqual([])
  })

  it("cronKey é único por rota — dois crons não podem se confundir na tabela", () => {
    const porCronKey = new Map<string, string[]>()
    for (const cronPath of readVercelCronPaths()) {
      const cronKey = /cronKey:\s*"([^"]+)"/.exec(readRouteSource(cronPath))?.[1]
      if (!cronKey) continue
      porCronKey.set(cronKey, [...(porCronKey.get(cronKey) ?? []), cronPath])
    }

    const duplicados = [...porCronKey.entries()].filter(([, paths]) => paths.length > 1)

    expect(duplicados).toEqual([])
  })

  it("nenhum gate de feature decide antes do withCronAudit", () => {
    const gateAntesDaAuditoria = readVercelCronPaths().filter((cronPath) => {
      const source = readRouteSource(cronPath)
      const gateIndex = source.indexOf("resolveWhatsAppGlobalFeatureGate(")
      if (gateIndex === -1) return false
      const auditIndex = source.indexOf("withCronAudit(")
      return auditIndex === -1 || gateIndex < auditIndex
    })

    expect(gateAntesDaAuditoria).toEqual([])
  })
})
