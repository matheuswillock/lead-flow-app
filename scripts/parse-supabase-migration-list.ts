#!/usr/bin/env bun
/**
 * Classifica a saída de `supabase migration list` em: histórico consistente com
 * migrations pendentes, ou histórico inconsistente (que trava a release).
 *
 * Vivia como `node -e '...'` dentro de `.github/workflows/ci-develop.yml`, sem
 * teste. Um bug de uma linha ali travou a esteira de release por 4+ execuções:
 * o CLI do Supabase renderiza célula vazia como crase-espaço-crase (`` ` ` ``),
 * e o `stripCell` fazia `.trim()` ANTES de remover as crases. Sobrava `" "` —
 * um espaço, que é truthy — então toda migration pendente era classificada como
 * "mismatch: local=X remote=" e derrubava o job.
 *
 * O `.trim()` depois do replace é o conserto. O arquivo separado é para o
 * próximo bug desse tipo falhar num teste em vez de numa release.
 *
 * Uso (o workflow chama assim):
 *   MIGRATION_LIST="$(supabase migration list --db-url "$DIRECT_URL" 2>&1)" \
 *     bun scripts/parse-supabase-migration-list.ts
 *
 * stdout: "true" | "false"  (há migrations pendentes)
 * exit 1 + stderr: histórico inconsistente, precisa de reparo manual
 */

export type MigrationListVerdict =
  | { ok: true; hasPending: boolean }
  | { ok: false; reason: string }

/**
 * Uma célula da tabela vem como `` `20260824010431` ``, e uma célula vazia vem
 * como `` ` ` ``. Trimar só antes das crases deixa o espaço interno vivo.
 */
export function stripMigrationCell(value: string): string {
  return value.trim().replace(/^`|`$/g, "").trim()
}

export function parseSupabaseMigrationList(input: string): MigrationListVerdict {
  let hasPending = false

  for (const line of input.split(/\r?\n/)) {
    // Só linhas de dado: o cabeçalho e o separador não têm timestamp.
    if (!/\d{14}/.test(line)) continue

    const parts = line.split(/[│|]/).map(stripMigrationCell)
    const local = parts[0] ?? ""
    const remote = parts[1] ?? ""

    // Aplicada no remoto mas ausente do repositório: alguém aplicou fora da
    // esteira. Só reparo manual resolve — seguir daqui geraria drift silencioso.
    if (!local && remote) {
      return {
        ok: false,
        reason: `Remote migration ${remote} not tracked locally. Repair history before continuing.`,
      }
    }

    // Timestamps divergentes na mesma linha: histórico reescrito.
    if (local && remote && local !== remote) {
      return { ok: false, reason: `Migration mismatch: local=${local} remote=${remote}` }
    }

    // No repositório e ainda não no remoto — pendente, que é estado NORMAL.
    // É exatamente este caso que o bug do espaço empurrava para o ramo acima.
    if (local && !remote) hasPending = true
  }

  return { ok: true, hasPending }
}

if (import.meta.main) {
  const verdict = parseSupabaseMigrationList(process.env.MIGRATION_LIST ?? "")
  if (!verdict.ok) {
    process.stderr.write(`${verdict.reason}\n`)
    process.exit(1)
  }
  process.stdout.write(verdict.hasPending ? "true" : "false")
}
