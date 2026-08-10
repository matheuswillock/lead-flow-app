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

function loadMigrationSql(): string {
  const migrationsDir = path.join(import.meta.dir, "../supabase/migrations")
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n")
}

describe("governance prisma model migrations", () => {
  it("cada @@map de model tem CREATE TABLE correspondente nas migrations", () => {
    const schema = readFileSync(path.join(import.meta.dir, "../prisma/schema.prisma"), "utf8")
    const migrationSql = loadMigrationSql()
    const tables = extractMappedTables(schema)

    const missing = tables.filter((table) => {
      const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const createPattern = new RegExp(`CREATE TABLE[\\s\\S]*"?${escaped}"?`, "i")
      return !createPattern.test(migrationSql)
    })

    expect(missing).toEqual([])
  })
})
