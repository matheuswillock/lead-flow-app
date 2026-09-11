import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Entregável 3 — requisito de segurança inegociável: o link de convite (credencial
 * de acesso de uso único) nunca aparece em `console.*` nem em log estruturado, e não
 * é persistido em tabela nenhuma. Teste estrutural (não de execução): varre o código-
 * fonte de todo arquivo que manipula `actionLink` e falha se alguma chamada `console.*`
 * referenciar essa variável.
 */
const FILES_TOUCHING_INVITE_LINK = [
  "lib/backoffice-member-access.ts",
  "app/api/useCases/backoffice/BackofficeMemberAccessEmailUseCase.ts",
  "app/api/v1/backoffice/members/[memberId]/access-email/route.ts",
  "app/backoffice/(app)/clients/[masterId]/features/services/BackofficeClientDetailsService.ts",
  "app/backoffice/(app)/clients/[masterId]/features/components/BackofficeMemberProfileSheet.tsx",
]

const REPO_ROOT = join(import.meta.dir, "..")

describe("link de convite nunca aparece em console.*", () => {
  for (const relativePath of FILES_TOUCHING_INVITE_LINK) {
    it(`${relativePath}: nenhuma chamada console.* referencia actionLink`, () => {
      const source = readFileSync(join(REPO_ROOT, relativePath), "utf8")

      const consoleCalls = source.match(/console\.\w+\([\s\S]*?\)(?=\s*[;\n])/g) ?? []
      const leaking = consoleCalls.filter((call) => /actionLink/.test(call))
      expect(leaking).toEqual([])
    })
  }
})
