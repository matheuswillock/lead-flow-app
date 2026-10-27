import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

// T-13.3b (SPEC 13, A-E1b): garante que os helpers de escape (`escapeHtml`,
// `escapeHtmlAttribute`, `escapeIcsText`) existem em um único lugar cada.
// Antes desta SPEC havia ~6 cópias locais de `escapeHtml` espalhadas
// (BackofficeLeadScheduleInviteService, BackofficeDemoLeadUseCase,
// x-post-embed, unsubscribe-link-embed, public-form-link-embed,
// custom-domain-dns-instructions) — cada uma podia divergir silenciosamente
// (ex.: `&#39;` vs `&#039;`, ou esquecer um caractere). O achado
// R13-1b-review1-1 da revisão mostrou o mesmo problema com `escapeIcsText`:
// a cópia em `BackofficeLeadScheduleInviteService.ts` não tratava `\r`
// porque cada arquivo reimplementava o escape do zero — a duplicação em si
// era a causa raiz, não só o `\r` esquecido numa cópia.
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"])
// Mesmas raízes que `collectFrontendSourceFiles` usa em
// `scripts/ai-governance.ts` para a varredura de diálogo nativo — é o
// conjunto de pastas onde código de produção (incluindo API/use cases) vive
// neste repositório.
const SCAN_ROOT_DIRECTORIES = ["app", "components", "hooks", "lib"]

interface SingleSourceHelper {
  name: string
  canonicalFile: string
}

const HELPERS: SingleSourceHelper[] = [
  { name: "escapeHtml", canonicalFile: "lib/email/escape-html.ts" },
  { name: "escapeHtmlAttribute", canonicalFile: "lib/email/escape-html.ts" },
  { name: "escapeIcsText", canonicalFile: "lib/email/escape-ics-text.ts" },
]

function buildLocalDefinitionRegex(helperName: string): RegExp {
  return new RegExp(`\\b(?:function|const)\\s+${helperName}\\s*[=(]`)
}

function collectSourceFiles(root: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(root)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue

    const fullPath = join(root, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath))
      continue
    }

    if (SOURCE_EXTENSIONS.has(fullPath.slice(fullPath.lastIndexOf(".")))) {
      files.push(fullPath)
    }
  }

  return files
}

function findLocalDefinitions(helper: SingleSourceHelper, filesToScan: string[]): string[] {
  const canonicalAbsolutePath = join(process.cwd(), helper.canonicalFile)
  const localDefinitionRegex = buildLocalDefinitionRegex(helper.name)
  const offenders: string[] = []

  for (const filePath of filesToScan) {
    if (filePath === canonicalAbsolutePath) continue
    if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) continue

    const content = readFileSync(filePath, "utf8")
    if (localDefinitionRegex.test(content)) {
      offenders.push(relative(process.cwd(), filePath))
    }
  }

  return offenders
}

describe("helpers de escape — fonte única (T-13.3b)", () => {
  const filesToScan = SCAN_ROOT_DIRECTORIES.flatMap((dir) => collectSourceFiles(join(process.cwd(), dir)))

  for (const helper of HELPERS) {
    test(`nenhuma cópia local de ${helper.name} fora de ${helper.canonicalFile}`, () => {
      expect(findLocalDefinitions(helper, filesToScan)).toEqual([])
    })
  }

  test("controle negativo: a varredura acusa uma cópia local de verdade", () => {
    const fakeFileContent = `
      function escapeHtml(value: string): string {
        return value.replace(/&/g, "&amp;")
      }
    `
    expect(buildLocalDefinitionRegex("escapeHtml").test(fakeFileContent)).toBe(true)
  })
})
