/**
 * Gera migration Supabase com SQL a partir de mudanças em prisma/schema.prisma.
 *
 * Fluxo:
 *   1. Remove migrations vazias com o mesmo sufixo (stale de db:migrate:new)
 *   2. prisma db push no banco local (Postgres :55322 — docker-compose.local.yml)
 *   3. supabase db diff --db-url <local> -f <nome> captura o delta em supabase/migrations/
 *   4. Deduplica arquivos com o mesmo sufixo (mantém o preenchido)
 *
 * Uso:
 *   bun run db:migrate:from-prisma -- add_my_table
 *   bun run db:migrate:from-prisma -- --dry-run add_my_table
 *
 * Requer o stack local rodando (porta 55322). Suba com `bun run local:up` ou `bun run dev:local`.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  describeFilterResult,
  filterUnmanagedStatements,
  readClientSideDefaults,
  type FilterResult,
} from "./db-migrate-diff-filter";
import {
  cleanupEmptyMigrationsBySuffix,
  dedupeMigrationsBySuffix,
  findNonEmptyMigrationsBySuffix,
  isEmptyMigrationContent,
  normalizeMigrationName,
  removeMigrationFile,
} from "./db-migrate-utils";
import { LOCAL_DB_URL, probeLocalPostgres } from "./lib/local-stack";

const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes("--dry-run");

/**
 * Traz os `ALTER COLUMN … DROP DEFAULT` para a migration em vez de filtrá-los.
 *
 * Existe porque intenção não é inferível do schema: uma coluna que sempre foi
 * `@updatedAt` puro e uma da qual acabaram de remover `@default(now())` geram a
 * mesma linha, e o default no banco é o mesmo (`CURRENT_TIMESTAMP`) nos dois
 * casos. A comparação com `HEAD` cobre a edição ainda não commitada, mas não é
 * garantia. Quando a remoção for deliberada, use esta flag.
 */
const includeDropDefault = rawArgs.includes("--include-drop-default");

const FLAGS = new Set(["--dry-run", "--include-drop-default"]);
const migrationName = rawArgs.find((arg) => !FLAGS.has(arg));

function fail(message: string): never {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function run(
  cmd: string,
  args: string[],
  envOverrides?: Partial<NodeJS.ProcessEnv>,
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    env: { ...process.env, ...envOverrides },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
  };
}

const SCHEMA_PATH = join("prisma", "schema.prisma");

/**
 * Versão do schema em HEAD, para distinguir "coluna nunca teve default físico"
 * de "o default acabou de ser removido". As duas produzem a mesma linha quando
 * sobra só `@updatedAt`. Best-effort: fora de um repo git, segue sem ela.
 */
function readCommittedSchema(): string | undefined {
  const result = run("git", ["show", `HEAD:${SCHEMA_PATH}`]);
  return result.status === 0 && result.stdout.trim() ? result.stdout : undefined;
}

/**
 * Colunas com default resolvido no Prisma Client. Só nelas o `DROP DEFAULT` é
 * ruído — em qualquer outra coluna a remoção é intencional e tem que aparecer.
 */
const clientSideDefaults = includeDropDefault
  ? new Set<string>()
  : readClientSideDefaults(readFileSync(SCHEMA_PATH, "utf8"), readCommittedSchema());

function logFilterResult(result: FilterResult): void {
  const lines = describeFilterResult(result);
  if (lines.length === 0) return;

  console.info(`\n▶ ${lines[0]}`);
  for (const line of lines.slice(1)) console.info(line);
}

function assertLocalStackRunning(): void {
  if (!probeLocalPostgres()) {
    fail(
      "Postgres local não está rodando. Execute `bun run local:up` ou `bun run dev` antes de gerar a migration.",
    );
  }
}

if (!migrationName) {
  console.error("❌ Informe o nome da migration.");
  console.error("");
  console.error("Exemplos:");
  console.error("  bun run db:migrate:from-prisma -- add_require_closer_gate");
  console.error("  bun run db:migrate:from-prisma -- --dry-run add_require_closer_gate");
  console.error("");
  console.error("Flags:");
  console.error("  --dry-run                mostra o SQL sem gravar arquivo");
  console.error(
    "  --include-drop-default   não filtra ALTER COLUMN … DROP DEFAULT (use quando",
  );
  console.error("                           a remoção do @default for deliberada)");
  console.error("");
  console.error("Para SQL manual (RLS, seeds): bun run db:migrate:new <name>");
  process.exit(1);
}

const normalizedName = normalizeMigrationName(migrationName);
if (!normalizedName) {
  fail("Nome da migration inválido.");
}

const localDbEnv = {
  DATABASE_URL: LOCAL_DB_URL,
  DIRECT_URL: LOCAL_DB_URL,
};

console.info(`\n▶ Gerando migration a partir de prisma/schema.prisma (${dryRun ? "dry-run" : normalizedName})`);

assertLocalStackRunning();

if (!dryRun) {
  const existingNonEmpty = findNonEmptyMigrationsBySuffix(normalizedName);
  if (existingNonEmpty.length > 0) {
    fail(
      `Migration "${normalizedName}" já existe com conteúdo: ${existingNonEmpty.map((f) => f.file).join(", ")}. Use outro nome ou remova manualmente.`,
    );
  }

  const removed = cleanupEmptyMigrationsBySuffix(normalizedName);
  if (removed.length > 0) {
    console.info(`\n▶ Removidas ${removed.length} migration(s) vazia(s) com sufixo "${normalizedName}"`);
  }
}

console.info("\n▶ Aplicando schema no banco local (prisma db push)…");
const push = run("bunx", ["prisma", "db", "push", "--accept-data-loss"], localDbEnv);

if (push.status !== 0) {
  console.error(push.stderr || push.stdout);
  fail("prisma db push falhou. Corrija o schema.prisma e tente novamente.");
}

const diffArgs = dryRun
  ? ["db", "diff", "--db-url", LOCAL_DB_URL, "--schema", "public"]
  : ["db", "diff", "--db-url", LOCAL_DB_URL, "-f", normalizedName, "--schema", "public"];

console.info(
  dryRun
    ? "\n▶ Diff (stdout apenas — nenhum arquivo será criado)…"
    : `\n▶ Capturando diff em supabase/migrations/*_${normalizedName}.sql…`,
);

const diff = run("supabase", diffArgs, {
  SUPABASE_DISABLE_TELEMETRY: "1",
  DO_NOT_TRACK: "1",
  // supabase/config.toml usa [db].port != 55322 (evita conflito com o stack
  // híbrido) — por não bater com o db-url, o CLI trata como "remoto" e força
  // SSL, que o Postgres local não tem habilitado.
  PGSSLMODE: "disable",
});

const diffOutput = `${diff.stdout}\n${diff.stderr}`.trim();

if (diff.status !== 0) {
  console.error(diffOutput);
  fail("supabase db diff falhou.");
}

if (dryRun) {
  if (isEmptyMigrationContent(diff.stdout)) {
    console.info("\n✅ Nenhuma diferença entre migrations aplicadas e schema.prisma.");
    process.exit(0);
  }

  const filtered = filterUnmanagedStatements(diff.stdout, clientSideDefaults);
  logFilterResult(filtered);

  if (!filtered.sql.trim()) {
    console.info("\n✅ Só havia ruído de ACL/default/policy. Nenhuma mudança de schema real.");
    process.exit(0);
  }

  console.info("\n--- SQL (preview) ---\n");
  console.info(filtered.sql.trim());
  console.info("\n--- fim do preview ---");
  console.info("\nPara gravar: bun run db:migrate:from-prisma --", normalizedName);
  process.exit(0);
}

if (isEmptyMigrationContent(diffOutput)) {
  cleanupEmptyMigrationsBySuffix(normalizedName);
  console.info("\n✅ Schema já alinhado com as migrations locais. Nenhum arquivo criado.");
  process.exit(0);
}

const migrationPath = dedupeMigrationsBySuffix(normalizedName);

if (!migrationPath) {
  console.error(diffOutput);
  fail(
    `supabase db diff não criou supabase/migrations/*_${normalizedName}.sql com conteúdo. Revise o output acima.`,
  );
}

const filtered = filterUnmanagedStatements(
  readFileSync(migrationPath, "utf8"),
  clientSideDefaults,
);
logFilterResult(filtered);

if (!filtered.sql.trim()) {
  removeMigrationFile(migrationPath);
  console.info(
    "\n✅ Só havia ruído de ACL/default/policy. Nenhuma mudança de schema real — arquivo removido.",
  );
  process.exit(0);
}

writeFileSync(migrationPath, filtered.sql);

console.info("\n✅ Migration criada:");
console.info(`   ${migrationPath}`);
console.info("\nPróximos passos:");
console.info("  1. Revisar o SQL gerado (ajustar idempotência se necessário)");
console.info("  2. bun run db:migrate:reset:local   # validar replay limpo");
console.info("  3. bun run db:migrate:push:dry-run  # revisar no remoto (com autorização)");
