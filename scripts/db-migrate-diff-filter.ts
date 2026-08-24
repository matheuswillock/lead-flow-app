/**
 * Filtro do SQL produzido por `supabase db diff`.
 *
 * O diff compara um shadow database (replay das migrations) com o banco local.
 * Três categorias de statement aparecem lá sem representar mudança de schema, e
 * o Prisma nunca as gerencia:
 *
 *   1. GRANT/REVOKE — o shadow não tem as entradas de `pg_default_acl` que a
 *      imagem `supabase/postgres` cria (`anon`, `authenticated`, `service_role`
 *      recebem `arwdDxtm` em toda tabela nova de `public`). Toda tabela sem
 *      GRANT explícito no SQL vira ruído. Medido em 2026-08-23: 1.092 de 1.853
 *      statements, 47,7% do arquivo.
 *
 *   2. ALTER COLUMN ... DROP DEFAULT — `@default(uuid())` e `@updatedAt` são
 *      resolvidos no Prisma Client, não no banco. O `prisma db push` derruba o
 *      default físico da coluna, e o diff propõe replicar isso na migration.
 *      Aplicar em produção deixaria 153 colunas `id`/`updatedAt` sem default
 *      para qualquer INSERT que não passe pelo Prisma (SQL raw, PostgREST,
 *      trigger, seed).
 *
 *   3. CREATE/DROP/ALTER POLICY e ENABLE/DISABLE ROW LEVEL SECURITY — RLS não é
 *      expressável no schema.prisma (ver o cabeçalho de `prisma/schema.prisma`).
 *      Toda tabela recriada pelo `db push` perde o RLS que a migration ligou, e
 *      o diff propõe desligar em definitivo. RLS pertence a migrations manuais
 *      via `bun run db:migrate:new`.
 *
 * Ver docs/audits/prisma-migrations-drift-2026-08-23.md para a medição completa.
 */

export type FilteredCategory = "acl" | "column-default" | "rls-policy";

export type FilterResult = {
  sql: string;
  removed: Record<FilteredCategory, number>;
  removedTotal: number;
};

export const FILTER_CATEGORY_LABELS: Record<FilteredCategory, string> = {
  acl: "GRANT/REVOKE (pg_default_acl do shadow database)",
  "column-default": "ALTER COLUMN … DROP DEFAULT (default físico da coluna)",
  "rls-policy": "POLICY / ROW LEVEL SECURITY (RLS não vive no schema.prisma)",
};

/**
 * Quebra o SQL em statements respeitando literais (`'…'`), identificadores
 * (`"…"`), dollar-quoting (`$$…$$`, `$tag$…$tag$`) e comentários. Um split
 * ingênuo por `;` corta corpos de função ao meio.
 */
export function splitSqlStatements(sql: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];

    if (char === "'" || char === '"') {
      index = skipQuoted(sql, index, char);
      continue;
    }

    if (char === "$") {
      const closed = skipDollarQuoted(sql, index);
      if (closed !== null) {
        index = closed;
        continue;
      }
    }

    if (char === "-" && sql[index + 1] === "-") {
      const newline = sql.indexOf("\n", index);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }

    if (char === "/" && sql[index + 1] === "*") {
      const end = sql.indexOf("*/", index + 2);
      index = end === -1 ? sql.length : end + 2;
      continue;
    }

    if (char === ";") {
      chunks.push(sql.slice(start, index + 1));
      start = index + 1;
    }

    index++;
  }

  const tail = sql.slice(start);
  if (tail.trim()) chunks.push(tail);

  return chunks;
}

function skipQuoted(sql: string, openIndex: number, quote: string): number {
  let index = openIndex + 1;
  while (index < sql.length) {
    if (sql[index] === "\\" && quote === "'") {
      index += 2;
      continue;
    }
    if (sql[index] === quote) {
      // Aspas duplicadas ('' ou "") escapam a si mesmas.
      if (sql[index + 1] === quote) {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index++;
  }
  return sql.length;
}

/** Retorna o índice após o fechamento do dollar-quote, ou null se não for um. */
function skipDollarQuoted(sql: string, openIndex: number): number | null {
  const match = /^\$[A-Za-z_]*\$/.exec(sql.slice(openIndex));
  if (!match) return null;

  const tag = match[0];
  const close = sql.indexOf(tag, openIndex + tag.length);
  return close === -1 ? sql.length : close + tag.length;
}

function normalize(statement: string): string {
  return statement
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function classifyStatement(statement: string): FilteredCategory | null {
  const text = normalize(statement);

  if (/^(grant|revoke)\s/.test(text)) return "acl";
  if (/^(create|drop|alter)\s+policy\s/.test(text)) return "rls-policy";
  if (/^alter\s+table\s+.+\s+(enable|disable|force|no\s+force)\s+row\s+level\s+security\s*;?$/.test(text)) {
    return "rls-policy";
  }
  if (/^alter\s+table\s+.+\s+alter\s+column\s+.+\s+drop\s+default\s*;?$/.test(text)) {
    return "column-default";
  }

  return null;
}

/**
 * O `supabase db diff` grava SQL puro no arquivo (`-f`), mas emite
 * `{"diff":"…","file":null,"schemas":["public"]}` no stdout quando não há TTY —
 * que é o caso do `--dry-run` rodando dentro do script. Desembrulha os dois.
 */
export function unwrapDiffOutput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return raw;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && typeof (parsed as { diff?: unknown }).diff === "string") {
      return (parsed as { diff: string }).diff;
    }
  } catch {
    // Não era JSON válido — trata como SQL puro.
  }

  return raw;
}

/** Remove do SQL as categorias que o Prisma nunca gerencia. */
export function filterUnmanagedStatements(input: string): FilterResult {
  const sql = unwrapDiffOutput(input);

  const removed: Record<FilteredCategory, number> = {
    acl: 0,
    "column-default": 0,
    "rls-policy": 0,
  };

  const kept: string[] = [];

  for (const raw of splitSqlStatements(sql)) {
    const category = classifyStatement(raw);
    if (category) {
      removed[category]++;
      continue;
    }
    kept.push(raw);
  }

  const removedTotal = removed.acl + removed["column-default"] + removed["rls-policy"];
  const joined = kept.join("").replace(/\n{3,}/g, "\n\n").trim();

  return {
    sql: joined ? `${joined}\n` : "",
    removed,
    removedTotal,
  };
}

/** Linhas de log descrevendo o que foi filtrado (vazio quando nada foi). */
export function describeFilterResult(result: FilterResult): string[] {
  if (result.removedTotal === 0) return [];

  const lines = [`Filtrados ${result.removedTotal} statement(s) que o Prisma não gerencia:`];
  for (const [category, count] of Object.entries(result.removed) as Array<
    [FilteredCategory, number]
  >) {
    if (count > 0) lines.push(`   ${count.toString().padStart(5)}  ${FILTER_CATEGORY_LABELS[category]}`);
  }
  lines.push("   Detalhes: docs/audits/prisma-migrations-drift-2026-08-23.md");

  return lines;
}
