import { describe, expect, it } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * M4.8 de [[10 — Fundações Multi-conta — Backend]] (E5, DA5): sentinela
 * estática — nenhum código fora do AsaasCustomerGateway pode montar um POST
 * /customers (criação de customer). "Bare" = `asaasApi.customers` passado
 * como argumento direto de `asaasFetch(`/`asaas(` (nunca interpolado em
 * template literal, `${asaasApi.customers}/algo`) — é exatamente o padrão
 * que distingue CRIAÇÃO ("/customers") das outras operações
 * (GET/PUT/DELETE em "/customers/{id}", sempre interpoladas).
 *
 * Roda em toda CI (não precisa de Postgres/rede) — é grep tipado, não
 * integração.
 */
const ROOT = join(import.meta.dir, "..", "..", "..", "..", "..")
const SCAN_DIRS = ["app", "lib"]
const ALLOWED_FILES = new Set([
  "app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway.ts",
])
const BARE_CUSTOMERS_CREATE_REGEX = /asaas(?:Fetch)?\(\s*asaasApi\.customers\s*,/

function shouldSkip(relativePath: string): boolean {
  if (relativePath.includes("node_modules")) return true
  if (!relativePath.endsWith(".ts") && !relativePath.endsWith(".tsx")) return true
  if (relativePath.endsWith(".test.ts") || relativePath.endsWith(".test.tsx")) return true
  if (relativePath.includes(".integration.test.")) return true
  return false
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue
      collectSourceFiles(full, out)
    } else {
      out.push(full)
    }
  }
  return out
}

function findEscapes(): Array<{ file: string; line: number; snippet: string }> {
  const escapes: Array<{ file: string; line: number; snippet: string }> = []

  for (const dir of SCAN_DIRS) {
    const absoluteDir = join(ROOT, dir)
    for (const absoluteFile of collectSourceFiles(absoluteDir)) {
      const relativePath = relative(ROOT, absoluteFile)
      if (shouldSkip(relativePath)) continue
      if (ALLOWED_FILES.has(relativePath)) continue

      const content = readFileSync(absoluteFile, "utf8")
      const lines = content.split("\n")
      lines.forEach((line, index) => {
        if (BARE_CUSTOMERS_CREATE_REGEX.test(line)) {
          escapes.push({ file: relativePath, line: index + 1, snippet: line.trim() })
        }
      })
    }
  }

  return escapes
}

describe("AsaasCustomerGateway — sentinela anti-escape (M4.8, T-10.14)", () => {
  it("nenhum POST /customers fora do gateway", () => {
    const escapes = findEscapes()

    if (escapes.length > 0) {
      const details = escapes
        .map((escape) => `  ${escape.file}:${escape.line} → ${escape.snippet}`)
        .join("\n")
      throw new Error(
        `POST /customers encontrado fora do AsaasCustomerGateway:\n${details}\n` +
          `Migre para asaasCustomerGateway.createCustomer({ profileId | adhesionId, ... }).`
      )
    }

    expect(escapes).toEqual([])
  })
})
