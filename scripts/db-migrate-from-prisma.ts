/**
 * Gera migration Supabase com SQL a partir de mudanças em prisma/schema.prisma.
 *
 * Fluxo:
 *   1. prisma db push no banco local (Supabase CLI)
 *   2. supabase db diff --local -f <nome> captura o delta em supabase/migrations/
 *
 * Uso:
 *   bun run db:migrate:from-prisma -- add_my_table
 *   bun run db:migrate:from-prisma -- --dry-run add_my_table
 *
 * Requer Supabase local rodando (porta 55322). Suba com `bun run dev:local` ou `supabase start`.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Mesma URL usada em scripts/dev-local.ts */
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

const MIGRATIONS_DIR = join("supabase", "migrations");

const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes("--dry-run");
const migrationName = rawArgs.find((arg) => arg !== "--dry-run");

function fail(message: string): never {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function normalizeMigrationName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    fail("Nome da migration inválido.");
  }

  return normalized;
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

function isEmptyDiff(sql: string): boolean {
  const trimmed = sql.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  return (
    lower.includes("no schema changes") ||
    lower.includes("no difference") ||
    lower.includes("this is an empty migration")
  );
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

function findLatestMigrationFile(suffix: string): string | null {
  const matches = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(`_${suffix}.sql`))
    .map((file) => ({
      file,
      mtime: statSync(join(MIGRATIONS_DIR, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return matches[0]?.file ?? null;
}

if (!migrationName) {
  console.error("❌ Informe o nome da migration.");
  console.error("");
  console.error("Exemplos:");
  console.error("  bun run db:migrate:from-prisma -- add_require_closer_gate");
  console.error("  bun run db:migrate:from-prisma -- --dry-run add_require_closer_gate");
  process.exit(1);
}

const normalizedName = normalizeMigrationName(migrationName);
const localDbEnv = {
  DATABASE_URL: LOCAL_DB_URL,
  DIRECT_URL: LOCAL_DB_URL,
};

console.info(`\n▶ Gerando migration a partir de prisma/schema.prisma (${dryRun ? "dry-run" : normalizedName})`);

assertLocalSupabaseRunning();

console.info("\n▶ Aplicando schema no banco local (prisma db push)…");
const push = run(process.execPath, ["x", "prisma", "db", "push", "--accept-data-loss"], localDbEnv);

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
  if (isEmptyDiff(diff.stdout)) {
    console.info("\n✅ Nenhuma diferença entre migrations aplicadas e schema.prisma.");
    process.exit(0);
  }

  console.info("\n--- SQL (preview) ---\n");
  console.info(diff.stdout.trim());
  console.info("\n--- fim do preview ---");
  console.info("\nPara gravar: bun run db:migrate:from-prisma --", normalizedName);
  process.exit(0);
}

if (isEmptyDiff(diffOutput)) {
  console.info("\n✅ Schema já alinhado com as migrations locais. Nenhum arquivo criado.");
  process.exit(0);
}

const createdFile = findLatestMigrationFile(normalizedName);

if (!createdFile) {
  console.error(diffOutput);
  fail(
    `supabase db diff não criou supabase/migrations/*_${normalizedName}.sql. Revise o output acima.`,
  );
}

const migrationPath = join(MIGRATIONS_DIR, createdFile);

console.info("\n✅ Migration criada:");
console.info(`   ${migrationPath}`);
console.info("\nPróximos passos:");
console.info("  1. Revisar o SQL gerado (ajustar idempotência se necessário)");
console.info("  2. bun run db:migrate:reset:local   # validar replay limpo");
console.info("  3. bun run db:migrate:push:dry-run  # revisar no remoto (com autorização)");
