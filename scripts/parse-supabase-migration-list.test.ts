import { describe, expect, it } from "bun:test"
import {
  parseSupabaseMigrationList,
  stripMigrationCell,
} from "./parse-supabase-migration-list"

/** Formato real do `supabase migration list`, copiado do log da CI. */
const HEADER = [
  "   Local            | Remote           | Time (UTC)            ",
  "  ------------------|------------------|-----------------------",
].join("\n")

const aplicada = (id: string) => `   \`${id}\` | \`${id}\` | \`2026-05-24 18:58:19\` `
/** Célula vazia vem como crase-espaço-crase — a origem do bug. */
const pendente = (id: string) => `   \`${id}\` | \` \`              | \`2026-08-24 01:04:31\` `
const soNoRemoto = (id: string) => `   \` \`              | \`${id}\` | \`2026-08-24 01:04:31\` `

function tabela(...linhas: string[]) {
  return [HEADER, ...linhas].join("\n")
}

describe("stripMigrationCell", () => {
  it("normaliza célula vazia crase-espaço-crase para string vazia", () => {
    // Regressão que travou a esteira de release: `.trim()` só antes do replace
    // deixava `" "`, que é truthy, e toda pendente virava "mismatch".
    expect(stripMigrationCell("` `")).toBe("")
    expect(stripMigrationCell("   ` `   ")).toBe("")
    expect(stripMigrationCell("`  `")).toBe("")
  })

  it("extrai o timestamp de célula preenchida", () => {
    expect(stripMigrationCell(" `20260824010431` ")).toBe("20260824010431")
  })

  it("tolera célula sem crases", () => {
    expect(stripMigrationCell("  20260824010431  ")).toBe("20260824010431")
    expect(stripMigrationCell("   ")).toBe("")
  })
})

describe("parseSupabaseMigrationList", () => {
  it("histórico alinhado → sem pendências", () => {
    const verdict = parseSupabaseMigrationList(
      tabela(aplicada("20260524185819"), aplicada("20260524200028")),
    )
    expect(verdict).toEqual({ ok: true, hasPending: false })
  })

  it("migrations locais ainda não aplicadas → PENDENTE, não inconsistente", () => {
    // O caso que derrubava a CI. São 11 assim na develop hoje.
    const verdict = parseSupabaseMigrationList(
      tabela(
        aplicada("20260823234849"),
        pendente("20260824010431"),
        pendente("20260824011707"),
      ),
    )
    expect(verdict).toEqual({ ok: true, hasPending: true })
  })

  it("aplicada no remoto e ausente do repositório → inconsistente", () => {
    const verdict = parseSupabaseMigrationList(tabela(soNoRemoto("20260824010431")))
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toContain("not tracked locally")
  })

  it("timestamps divergentes na mesma linha → inconsistente", () => {
    const verdict = parseSupabaseMigrationList(
      tabela("   `20260824010431` | `20260824999999` | `2026-08-24 01:04:31` "),
    )
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toContain("Migration mismatch")
  })

  it("ignora cabeçalho e separador", () => {
    expect(parseSupabaseMigrationList(HEADER)).toEqual({ ok: true, hasPending: false })
    // Sem esse filtro, "Local | Remote" viraria local="Local" remote="Remote"
    // e dispararia mismatch no cabeçalho.
    expect(parseSupabaseMigrationList("")).toEqual({ ok: true, hasPending: false })
  })

  it("aceita a variante com barra vertical unicode", () => {
    const verdict = parseSupabaseMigrationList(
      "   `20260824010431` │ ` `              │ `2026-08-24 01:04:31` ",
    )
    expect(verdict).toEqual({ ok: true, hasPending: true })
  })

  it("inconsistência tem precedência sobre pendência", () => {
    const verdict = parseSupabaseMigrationList(
      tabela(pendente("20260824010431"), soNoRemoto("20260824011707")),
    )
    expect(verdict.ok).toBe(false)
  })
})
