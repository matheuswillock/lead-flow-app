/**
 * Gera migration Supabase com SQL a partir de mudanças em prisma/schema.prisma.
 *
 * Fluxo:
 *   1. Remove migrations vazias com o mesmo sufixo (stale de db:migrate:new)
 *   2. prisma db push no banco local (Supabase CLI)
 *   3. supabase db diff --local -f <nome> captura o delta em supabase/migrations/
 *   4. Deduplica arquivos com o mesmo sufixo (mantém o preenchido)
 *
 * Uso:
 *   bun run db:migrate:from-prisma -- add_my_table
 *   bun run db:migrate:from-prisma -- --dry-run add_my_table
 *
 * Requer Supabase local rodando (porta 55322). Suba com `bun run dev:local` ou `supabase start`.
 */

import { spawnSync } from "node:child_process";

import {
  cleanupEmptyMigrationsBySuffix,
  dedupeMigrationsBySuffix,
  findNonEmptyMigrationsBySuffix,
  isEmptyMigrationContent,
  normalizeMigrationName,
} from "./db-migrate-utils";

/** Mesma URL usada em scripts/dev-local.ts */
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes("--dry-run");
const migrationName = rawArgs.find((arg) => arg !== "--dry-run");

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

function assertLocalSupabaseRunning(): void {
  const status = run("supabase", ["status"], {
    SUPABASE_DISABLE_TELEMETRY: "1",
    DO_NOT_TRACK: "1",
  });

  if (status.status !== 0) {
    fail(
      "Supabase local não está rodando. Execute `supabase start` ou `bun run dev:local` antes de gerar a migration.",
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

assertLocalSupabaseRunning();

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
  ? ["db", "diff", "--local", "--schema", "public"]
  : ["db", "diff", "--local", "-f", normalizedName, "--schema", "public"];

console.info(
  dryRun
    ? "\n▶ Diff (stdout apenas — nenhum arquivo será criado)…"
    : `\n▶ Capturando diff em supabase/migrations/*_${normalizedName}.sql…`,
);

const diff = run("supabase", diffArgs, {
  SUPABASE_DISABLE_TELEMETRY: "1",
  DO_NOT_TRACK: "1",
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

  console.info("\n--- SQL (preview) ---\n");
  console.info(diff.stdout.trim());
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

console.info("\n✅ Migration criada:");
console.info(`   ${migrationPath}`);
console.info("\nPróximos passos:");
console.info("  1. Revisar o SQL gerado (ajustar idempotência se necessário)");
console.info("  2. bun run db:migrate:reset:local   # validar replay limpo");
console.info("  3. bun run db:migrate:push:dry-run  # revisar no remoto (com autorização)");
