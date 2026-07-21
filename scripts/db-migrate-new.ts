/**
 * Cria migration manual vazia (RLS, seeds, triggers).
 * Evita duplicatas quando o mesmo sufixo já existe.
 *
 * Uso:
 *   bun run db:migrate:new seed_my_feature
 *
 * Para mudanças de schema.prisma use `bun run db:migrate:from-prisma -- <name>`.
 */

import { spawnSync } from "node:child_process";

import {
  findMigrationFilesBySuffix,
  isEmptyMigrationFile,
  normalizeMigrationName,
  findNonEmptyMigrationsBySuffix,
} from "./db-migrate-utils";

const rawName = process.argv.slice(2).join(" ").trim();

function fail(message: string): never {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function run(cmd: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_DISABLE_TELEMETRY: "1",
      DO_NOT_TRACK: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
  };
}

if (!rawName) {
  console.error("❌ Informe o nome da migration.");
  console.error("");
  console.error("Exemplos:");
  console.error("  bun run db:migrate:new seed_whatsapp_settings");
  console.error("");
  console.error("Para schema.prisma: bun run db:migrate:from-prisma -- add_my_column");
  process.exit(1);
}

const normalizedName = normalizeMigrationName(rawName);
if (!normalizedName) {
  fail("Nome da migration inválido.");
}

const existingNonEmpty = findNonEmptyMigrationsBySuffix(normalizedName);
if (existingNonEmpty.length > 0) {
  fail(
    `Migration "${normalizedName}" já existe com conteúdo: ${existingNonEmpty.map((f) => f.file).join(", ")}. Use outro nome.`,
  );
}

const existingEmpty = findMigrationFilesBySuffix(normalizedName).filter((f) =>
  isEmptyMigrationFile(f.path),
);

if (existingEmpty.length > 0) {
  const reuse = existingEmpty[existingEmpty.length - 1];
  console.info("\n✅ Migration vazia já existe — reutilizando (não criou duplicata):");
  console.info(`   ${reuse.path}`);
  console.info("\nEdite o SQL manualmente e depois:");
  console.info("  bun run db:migrate:reset:local");
  process.exit(0);
}

console.info(`\n▶ Criando migration manual: ${normalizedName}`);

const created = run("supabase", ["migration", "new", normalizedName]);
const output = `${created.stdout}\n${created.stderr}`.trim();

if (created.status !== 0) {
  console.error(output);
  fail("supabase migration new falhou.");
}

if (output) {
  console.info(output);
}

const createdFiles = findMigrationFilesBySuffix(normalizedName);
const latest = createdFiles[createdFiles.length - 1];

if (!latest) {
  fail(`Não foi possível localizar supabase/migrations/*_${normalizedName}.sql após criação.`);
}

console.info("\n✅ Migration criada:");
console.info(`   ${latest.path}`);
console.info("\nEdite o SQL manualmente e depois:");
console.info("  bun run db:migrate:reset:local");
