import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { isSamePath } from "./ai-governance"

describe("isSamePath", () => {
  let dir: string

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-governance-same-path-"))
  })

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it("é true para o mesmo caminho absoluto", async () => {
    const target = path.join(dir, "agents.md")
    await fs.writeFile(target, "conteudo", "utf8")
    expect(await isSamePath(target, target)).toBe(true)
  })

  it("regressão: AGENTS.md e agents.md são arquivos DIFERENTES num filesystem case-sensitive — não pode pular a sincronização (P1 do review #1113)", async () => {
    const lower = path.join(dir, "agents.md")
    const upper = path.join(dir, "AGENTS.md")
    await fs.writeFile(lower, "conteudo canonico", "utf8")
    await fs.writeFile(upper, "conteudo desatualizado do adapter", "utf8")

    expect(await isSamePath(lower, upper)).toBe(false)
  })

  it("caminhos com nomes diferentes só por maiúscula, mas onde um ainda não existe, não são tratados como o mesmo arquivo", async () => {
    const lower = path.join(dir, "only-lower.md")
    const upperMissing = path.join(dir, "ONLY-LOWER.md")
    await fs.writeFile(lower, "conteudo", "utf8")

    expect(await isSamePath(lower, upperMissing)).toBe(false)
  })
})
