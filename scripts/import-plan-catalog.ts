/**
 * Importa a base do simulador de planos (base-simulador.json) para o banco
 * e grava os logos das operadoras em public/operadoras.
 *
 * Uso:
 *   bun run scripts/import-plan-catalog.ts --file <caminho> --dry-run
 *   bun run scripts/import-plan-catalog.ts --file <caminho> --confirm-host <host-do-banco> [--logos <html-do-protótipo>]
 *
 * Sem --confirm-host a gravação é recusada. O host precisa bater com o DATABASE_URL.
 * Regras de negócio ficam em lib/planCatalog (testadas); este arquivo só faz I/O.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { importPlanCatalog } from "@/lib/planCatalog/importPlanCatalog"
import { extractLogodbFromPrototype, planLogoFiles } from "@/lib/planCatalog/planCatalogLogos"
import { assertImportTarget } from "@/lib/planCatalog/importTarget"
import { PrismaPlanCatalogRepository } from "@/app/api/infra/data/repositories/planCatalog/PrismaPlanCatalogRepository"

function readArg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const file = readArg("--file")
  const dryRun = process.argv.includes("--dry-run")
  const confirmHost = readArg("--confirm-host")

  if (!file) throw new Error("Informe --file <caminho do base-simulador.json>.")

  const raw = JSON.parse(await readFile(file, "utf8")) as unknown

  if (dryRun) {
    const result = await importPlanCatalog(raw, new PrismaPlanCatalogRepository(), { source: file, dryRun: true })
    if (!result.ok) return fail(result.issues)
    console.info("[import-plan-catalog] dry-run ok", result.counts)
    return
  }

  const { host } = assertImportTarget(process.env.DATABASE_URL, confirmHost)

  // Logos vêm do HTML do protótipo (<script id="logodb">), não do JSON.
  const logosPath = readArg("--logos")
  if (logosPath) {
    const logodb = extractLogodbFromPrototype(await readFile(logosPath, "utf8"))
    const { files, errors } = planLogoFiles(logodb)
    if (errors.length) return fail(errors)
    for (const f of files) {
      const target = join(process.cwd(), "public", f.path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, f.content)
    }
    console.info(`[import-plan-catalog] ${files.length} logos gravados em public/operadoras`)
  }

  const result = await importPlanCatalog(raw, new PrismaPlanCatalogRepository(), { source: file, dryRun: false })
  if (!result.ok) return fail(result.issues)
  console.info(`[import-plan-catalog] importado em ${host}`, result.counts)
}

function fail(issues: string[]): never {
  console.error(`[import-plan-catalog] recusado (${issues.length} problema(s)):`)
  for (const issue of issues.slice(0, 50)) console.error(` - ${issue}`)
  process.exit(1)
}

main().catch((error) => {
  console.error("[import-plan-catalog] erro:", error instanceof Error ? error.message : error)
  process.exit(1)
})
