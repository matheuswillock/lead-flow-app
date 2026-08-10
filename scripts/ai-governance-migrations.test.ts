import { describe, expect, it } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

function extractMappedTables(schema: string): string[] {
  const tables: string[] = []
  const modelBlocks = schema.split(/^model /m).slice(1)
  for (const block of modelBlocks) {
    const mapMatch = block.match(/@@map\("([^"]+)"\)/)
    if (mapMatch) tables.push(mapMatch[1])
  }
  return tables
}

function tableHasCreateStatement(sql: string, table: string): boolean {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const headerPattern = new RegExp(
    `^(?:\\s+IF\\s+NOT\\s+EXISTS\\s+)?(?:(?:public|"public")\\.)?"?${escaped}"?\\s*\\(`,
    "i",
  )
  if (
    sql
      .split(/\bCREATE\s+TABLE\b/i)
      .slice(1)
      .some((block) => headerPattern.test(block))
  ) {
    return true
  }

  const renamePattern = new RegExp(`RENAME\\s+TO\\s+"${escaped}"`, "i")
  if (renamePattern.test(sql)) {
    return true
  }

  if (sql.includes(`"${table}"`) && /\b(?:RENAME\s+TO|ALTER\s+TABLE)\b/i.test(sql)) {
    return true
  }

  if (
    table.startsWith("corretor_studio_radar_") &&
    /corretor_studio_radar_%s/.test(sql) &&
    /\bRENAME\s+TO\b/i.test(sql)
  ) {
    return true
  }

  const legacyPattern = new RegExp(`CREATE\\s+TABLE[\\s\\S]*"?${escaped}"?`, "i")
  return legacyPattern.test(sql)
}

function loadMigrationContents(): string[] {
  const migrationsDir = path.join(import.meta.dir, "../supabase/migrations")
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
}

describe("governance prisma model migrations", () => {
  it("cada @@map de model tem CREATE TABLE correspondente nas migrations", () => {
    const schema = readFileSync(path.join(import.meta.dir, "../prisma/schema.prisma"), "utf8")
    const migrationContents = loadMigrationContents()
    const tables = extractMappedTables(schema)

    const missing = tables.filter(
      (table) => !migrationContents.some((sql) => tableHasCreateStatement(sql, table)),
    )

    expect(missing).toEqual([])
  })
})
