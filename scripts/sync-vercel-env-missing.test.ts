import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// scripts/sync-vercel-env-missing.ts roda `main()` no import (chama `vercel`
// via spawnSync) — importar o módulo em teste dispararia o CLI de verdade.
// Por isso este teste lê o arquivo como texto (T-10.6, fallback previsto na
// SPEC quando o script não é testável por import direto).
const SCRIPT_PATH = join(import.meta.dir, "sync-vercel-env-missing.ts")
const ENV_EXAMPLE_PATH = join(import.meta.dir, "..", ".env.example")

const LEGACY_ASAAS_KEYS = [
  "ASAAS_SANDBOX_API_KEY",
  "ASAAS_LEGACY_API_KEY",
  "ASAAS_LEGACY_WEBHOOK_TOKEN",
  "ASAAS_LEGACY_SANDBOX_API_KEY",
] as const

describe("sync-vercel-env-missing — vars legacy do Asaas (E2/T-10.6)", () => {
  it("OPTIONAL_EMPTY_KEYS contém as quatro vars legacy/sandbox novas", () => {
    const source = readFileSync(SCRIPT_PATH, "utf8")
    const optionalBlockMatch = source.match(
      /const OPTIONAL_EMPTY_KEYS = new Set\(\[([\s\S]*?)\]\);/
    )
    expect(optionalBlockMatch).not.toBeNull()

    const optionalBlock = optionalBlockMatch![1]
    for (const key of LEGACY_ASAAS_KEYS) {
      expect(optionalBlock).toContain(`"${key}"`)
    }
  })

  it(".env.example documenta as quatro vars (a lista de sync é derivada dela)", () => {
    const envExample = readFileSync(ENV_EXAMPLE_PATH, "utf8")
    for (const key of LEGACY_ASAAS_KEYS) {
      expect(envExample).toMatch(new RegExp(`^${key}=`, "m"))
    }
  })
})
