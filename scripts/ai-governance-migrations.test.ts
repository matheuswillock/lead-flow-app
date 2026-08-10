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
  // Somente o identificador alvo do CREATE TABLE (não menções em FK/ALTER posteriores).
  const createTarget = new RegExp(
    `\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:(?:public|"public")\\.)?"?${escaped}"?\\s*\\(`,
    "i",
  )
  if (createTarget.test(sql)) {
    return true
  }

  const renamePattern = new RegExp(`RENAME\\s+TO\\s+"?${escaped}"?\\b`, "i")
  if (renamePattern.test(sql)) {
    return true
  }

  if (
    table.startsWith("corretor_studio_radar_") &&
    /corretor_studio_radar_%s/.test(sql) &&
    /\bRENAME\s+TO\b/i.test(sql)
  ) {
    return true
  }

  return false
}

function loadMigrationContents(): string[] {
  const migrationsDir = path.join(import.meta.dir, "../supabase/migrations")
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
}

describe("tableHasCreateStatement", () => {
  it("reconhece CREATE TABLE cujo alvo é a tabela", () => {
    const sql = `CREATE TABLE "public"."my_table" (\n  id uuid\n);`
    expect(tableHasCreateStatement(sql, "my_table")).toBe(true)
  })

  it("reconhece RENAME TO da tabela alvo", () => {
    const sql = `ALTER TABLE "old_name" RENAME TO "my_table";`
    expect(tableHasCreateStatement(sql, "my_table")).toBe(true)
  })

  it("não conta menção em FK/ALTER de outra tabela", () => {
    const sql = `
CREATE TABLE "other_table" (
  id uuid,
  "my_table_id" uuid REFERENCES "my_table"("id")
);
ALTER TABLE "other_table" ADD COLUMN "note" text;
`
    expect(tableHasCreateStatement(sql, "my_table")).toBe(false)
  })

  it("não conta ALTER TABLE de outra tabela só porque o nome aparece no arquivo", () => {
    const sql = `
-- comment mentioning "my_table"
ALTER TABLE "other_table" RENAME TO "renamed_other";
`
    expect(tableHasCreateStatement(sql, "my_table")).toBe(false)
  })
})

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
