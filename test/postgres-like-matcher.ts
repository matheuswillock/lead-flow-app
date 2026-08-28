/**
 * Semântica de `LIKE`/`ILIKE` do Postgres reimplementada para os testes de
 * trava do curinga de e-mail, medida em 24/08/2026 contra o Postgres local
 * (`supabase/postgres:17.6.1.149`) via Prisma 6.19.3:
 *
 *   ILIKE 'maria_silva@example.com'  -> maria.silva@, maria_silva@,
 *                                       Maria_Silva@, mariaXsilva@
 *   ILIKE 'maria\_silva@example.com' -> maria_silva@, Maria_Silva@
 *   ILIKE '\%@example.com'           -> nada
 *
 * Os fakes que usam isto são a trava: se alguém tirar o `escapeLikePattern` de
 * um filtro `{ equals, mode: "insensitive" }`, o curinga volta a valer aqui e o
 * teste falha. Ver `lib/prisma/escape-like-pattern.ts`.
 */

/** `_` casa um caractere, `%` casa N, `\` torna o próximo literal. */
export function ilike(value: string, pattern: string): boolean {
  const literal = (char: string) => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  let asRegex = ""
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === "\\" && index + 1 < pattern.length) {
      index += 1
      asRegex += literal(pattern[index])
    } else if (char === "_") {
      asRegex += "."
    } else if (char === "%") {
      asRegex += ".*"
    } else {
      asRegex += literal(char)
    }
  }
  return new RegExp(`^${asRegex}$`, "i").test(value)
}

export type EmailFilter = string | { equals?: string; in?: string[]; mode?: string }

/** Aplica um filtro de e-mail do Prisma como o Postgres aplicaria. */
export function matchesEmail(email: string | null, filter: EmailFilter | undefined): boolean {
  if (filter === undefined) return true
  if (email === null) return false
  if (typeof filter === "string") return email === filter
  if (Array.isArray(filter.in)) {
    return filter.mode === "insensitive"
      ? filter.in.some((pattern) => ilike(email, pattern))
      : filter.in.includes(email)
  }
  if (typeof filter.equals === "string") {
    return filter.mode === "insensitive" ? ilike(email, filter.equals) : email === filter.equals
  }
  throw new Error(`filtro de e-mail não previsto por este fake: ${JSON.stringify(filter)}`)
}
