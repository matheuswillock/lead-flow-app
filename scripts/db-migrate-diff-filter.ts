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
 *   2. ALTER COLUMN ... DROP DEFAULT **em coluna cujo default o Prisma resolve
 *      no client** — `@default(uuid())`, `@default(cuid())` e `@updatedAt` não
 *      viram default físico, então o `prisma db push` derruba o que a migration
 *      criou e o diff propõe replicar isso. Aplicar em produção deixaria 155
 *      colunas `id`/`updatedAt` sem default para qualquer INSERT que não passe
 *      pelo Prisma (SQL raw, PostgREST, trigger, seed).
 *
 *      O filtro consulta o `prisma/schema.prisma` coluna a coluna e **só**
 *      descarta esses casos. Um `DROP DEFAULT` de coluna que tem default físico
 *      é remoção intencional e passa direto — do contrário, tirar um
 *      `@default(...)` do schema viraria uma mudança que o gerador engole em
 *      silêncio e reporta como "nenhuma diferença". Atenção ao caso
 *      `@default(now()) @updatedAt`: o `@updatedAt` sozinho é client-side, mas
 *      com `@default(now())` junto o banco fica com `CURRENT_TIMESTAMP`.
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
  "column-default": "ALTER COLUMN … DROP DEFAULT (só em coluna sem default físico)",
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

/**
 * Retorna o índice após o fechamento do dollar-quote, ou null se não for um.
 *
 * A tag segue a regra de identificador do Postgres: começa com letra ou `_` e
 * daí aceita dígitos também (`$fn1$`, `$tag_2$`). Sem os dígitos, `$fn1$` não
 * era reconhecido como delimitador e o splitter cortava dentro do corpo da
 * função — se o pedaço resultante começasse com `GRANT` ou DDL de policy, o
 * filtro descartaria um trecho do meio do statement.
 */
function skipDollarQuoted(sql: string, openIndex: number): number | null {
  const match = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(openIndex));
  if (!match) return null;

  const tag = match[0];
  const close = sql.indexOf(tag, openIndex + tag.length);
  return close === -1 ? sql.length : close + tag.length;
}

function stripComments(statement: string): string {
  return statement.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function normalize(statement: string): string {
  return stripComments(statement).replace(/\s+/g, " ").trim().toLowerCase();
}

const DROP_DEFAULT_CI =
  /^alter\s+table\s+(?:"?public"?\.)?"?([\w]+)"?\s+alter\s+column\s+"?([\w]+)"?\s+drop\s+default\s*;?$/i;

/**
 * Colunas cujo default o Prisma resolve no client — a chave é `tabela.coluna`
 * em nomes FÍSICOS (já resolvidos por `@@map`/`@map`).
 */
export type ClientSideDefaults = ReadonlySet<string>;

export function classifyStatement(
  statement: string,
  clientSideDefaults: ClientSideDefaults = new Set(),
): FilteredCategory | null {
  const text = normalize(statement);

  if (/^(grant|revoke)\s/.test(text)) return "acl";
  if (/^(create|drop|alter)\s+policy\s/.test(text)) return "rls-policy";
  if (/^alter\s+table\s+.+\s+(enable|disable|force|no\s+force)\s+row\s+level\s+security\s*;?$/.test(text)) {
    return "rls-policy";
  }

  // `normalize()` rebaixa para minúsculas e o schema usa camelCase, então o
  // nome da coluna precisa sair do texto original — preservando a caixa.
  const dropDefault = stripComments(statement).replace(/\s+/g, " ").trim().match(DROP_DEFAULT_CI);
  if (dropDefault) {
    return clientSideDefaults.has(`${dropDefault[1]}.${dropDefault[2]}`) ? "column-default" : null;
  }

  return null;
}

/** Geradores que o Prisma Client resolve em memória, sem default no banco. */
const CLIENT_GENERATOR = /@default\(\s*(?:uuid|cuid|ulid|nanoid)\s*\(/;
const HAS_DEFAULT = /@default\(/;
const IS_UPDATED_AT = /@updatedAt\b/;

/**
 * Um campo só é "client-side" quando o banco NÃO fica com default físico.
 *
 * `@updatedAt` sozinho é client-side. Mas `@default(now()) @updatedAt` — que
 * este schema usa em 5 campos — vira `DEFAULT CURRENT_TIMESTAMP` no banco:
 * remover só o `@default(now())` produz um `DROP DEFAULT` intencional, que não
 * pode ser filtrado. Como um campo tem no máximo um `@default`, basta olhar
 * qual é: gerador de client → filtra; qualquer outro (now(), literal,
 * dbgenerated, autoincrement) → default físico, não filtra.
 */
function isClientSideDefault(fieldLine: string): boolean {
  if (CLIENT_GENERATOR.test(fieldLine)) return true;
  if (HAS_DEFAULT.test(fieldLine)) return false;
  return IS_UPDATED_AT.test(fieldLine);
}

/** Percorre os campos de cada model resolvendo o nome físico de tabela/coluna. */
function forEachField(
  schemaSource: string,
  visit: (column: string, fieldLine: string) => void,
): void {
  for (const model of schemaSource.matchAll(/model\s+\w+\s*\{([\s\S]*?)\n\}/g)) {
    const body = model[1];
    const tableMap = body.match(/@@map\("([^"]+)"\)/);
    const modelName = /model\s+(\w+)/.exec(model[0])?.[1] ?? "";
    const table = tableMap ? tableMap[1] : modelName;

    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;

      const field = trimmed.match(/^(\w+)\s+\S+/);
      if (!field) continue;

      const columnMap = trimmed.match(/@map\("([^"]+)"\)/);
      visit(`${table}.${columnMap ? columnMap[1] : field[1]}`, trimmed);
    }
  }
}

/**
 * Lê `prisma/schema.prisma` e devolve as colunas com default resolvido no
 * Prisma Client. Só essas podem ter o `DROP DEFAULT` descartado: nas demais, a
 * remoção do default é intencional e precisa chegar na migration.
 *
 * `previousSchemaSource` (tipicamente `git show HEAD:prisma/schema.prisma`)
 * fecha um buraco que a análise do schema atual sozinha não consegue ver:
 * `@default(now()) @updatedAt` e `@updatedAt` puro produzem a MESMA linha
 * depois que alguém remove o `@default(now())`. Sem o estado anterior, essa
 * remoção intencional seria classificada como client-side e filtrada. Com ele,
 * a coluna que tinha `@default` antes e não tem agora fica de fora da
 * allowlist, e o `DROP DEFAULT` chega na migration.
 */
export function readClientSideDefaults(
  schemaSource: string,
  previousSchemaSource?: string,
): Set<string> {
  const result = new Set<string>();
  forEachField(schemaSource, (column, line) => {
    if (isClientSideDefault(line)) result.add(column);
  });

  if (!previousSchemaSource) return result;

  forEachField(previousSchemaSource, (column, line) => {
    // Tinha default físico antes e não tem mais: remoção deliberada.
    if (HAS_DEFAULT.test(line) && !CLIENT_GENERATOR.test(line)) result.delete(column);
  });

  return result;
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
export function filterUnmanagedStatements(
  input: string,
  clientSideDefaults: ClientSideDefaults = new Set(),
): FilterResult {
  const sql = unwrapDiffOutput(input);

  const removed: Record<FilteredCategory, number> = {
    acl: 0,
    "column-default": 0,
    "rls-policy": 0,
  };

  const kept: string[] = [];

  for (const raw of splitSqlStatements(sql)) {
    const category = classifyStatement(raw, clientSideDefaults);
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
  if (result.removed["column-default"] > 0) {
    lines.push(
      "   Removeu um @default de propósito? Rode com --include-drop-default para",
      "   trazer o DROP DEFAULT para a migration — o filtro não infere intenção.",
    );
  }
  lines.push("   Detalhes: docs/audits/prisma-migrations-drift-2026-08-23.md");

  return lines;
}
