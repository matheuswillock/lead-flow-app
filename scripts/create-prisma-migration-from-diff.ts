import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const migrationName = process.argv[2];

if (!migrationName) {
  console.error("❌ Informe o nome da migration.");
  console.error("");
  console.error("Exemplo:");
  console.error("bun run prisma:migrate -- add_react_email_tables");
  process.exit(1);
}

const normalizedName = migrationName
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

if (!normalizedName) {
  console.error("❌ Nome da migration inválido.");
  process.exit(1);
}

const now = new Date();

const timestamp =
  now.getFullYear().toString() +
  String(now.getMonth() + 1).padStart(2, "0") +
  String(now.getDate()).padStart(2, "0") +
  String(now.getHours()).padStart(2, "0") +
  String(now.getMinutes()).padStart(2, "0") +
  String(now.getSeconds()).padStart(2, "0");

const migrationDir = join(
  "prisma",
  "migrations",
  `${timestamp}_${normalizedName}`,
);

if (existsSync(migrationDir)) {
  console.error(`❌ A pasta da migration já existe: ${migrationDir}`);
  process.exit(1);
}

/**
 * Use the current Bun executable instead of calling `bunx` directly.
 *
 * This avoids Windows/Git Bash PATH issues like:
 * "Executable not found in $PATH: bunx.cmd"
 *
 * Equivalent command:
 * bun x prisma migrate diff ...
 */
const result = spawnSync(
  process.execPath,
  [
    "x",
    "prisma",
    "migrate",
    "diff",
    "--from-schema-datasource",
    "prisma/schema.prisma",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

if (result.error) {
  console.error("❌ Erro ao executar prisma migrate diff:");
  console.error(result.error.message);
  process.exit(1);
}

const stdout = result.stdout?.toString() ?? "";
const stderr = result.stderr?.toString() ?? "";

if (result.status !== 0) {
  console.error("❌ Erro ao gerar migration via prisma migrate diff:");
  console.error(stderr || stdout);
  process.exit(result.status ?? 1);
}

const sql = stdout.trim();

const isEmptyMigration =
  !sql ||
  sql.includes("This is an empty migration") ||
  sql.includes("No difference detected");

if (isEmptyMigration) {
  console.info("✅ Nenhuma diferença encontrada entre o banco e o schema.prisma.");
  console.info("Nenhuma migration foi criada.");
  process.exit(0);
}

mkdirSync(migrationDir, { recursive: true });

const migrationPath = join(migrationDir, "migration.sql");

try {
  writeFileSync(
    migrationPath,
    `-- Migration generated from database diff to prisma/schema.prisma\n\n${sql}\n`,
    "utf8",
  );
} catch (error) {
  rmSync(migrationDir, { recursive: true, force: true });

  console.error("❌ Erro ao salvar migration.sql:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.info("✅ Migration criada com sucesso:");
console.info(migrationPath);
console.info("");
console.info("Revise o SQL antes de aplicar no Supabase remoto.");
console.info("");
console.info("Próximos comandos:");
console.info("bun run prisma:migrate:deploy");
console.info("bun run prisma:migrate:status");