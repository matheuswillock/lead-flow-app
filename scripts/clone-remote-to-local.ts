/**
 * Clone the linked remote Supabase database (data only) into the local stack.
 *
 * Flow:
 *  1. Dump data from remote for the `auth`, `storage` and `public` schemas.
 *  2. Reset the local Supabase DB so the schema matches the migrations head.
 *  3. Restore the dumps in order (auth → storage → public).
 *
 * The schema itself is not dumped — it comes from `supabase/migrations/`,
 * guaranteeing that local and remote schemas stay in sync.
 *
 * Run with: bun run db:clone:remote
 *
 * Optional flag:
 *   --keep-dumps  Keep the .sql files under tmp/db-clone/ after restore.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DUMP_DIR = resolve(process.cwd(), "tmp", "db-clone");
const SCHEMAS: Array<{ name: "auth" | "storage" | "public"; file: string }> = [
  { name: "auth", file: "auth.sql" },
  { name: "storage", file: "storage.sql" },
  { name: "public", file: "public.sql" },
];

const keepDumps = process.argv.includes("--keep-dumps");
const DROPPED_PROFILE_COLUMNS = new Set([
  "canCreateAccountUsers",
  "canManageAccountTeams",
  "canTransferAccountLeads",
]);

function step(label: string) {
  console.info(`\n▶ ${label}`);
}

function run(cmd: string, args: string[], opts: { stdio?: "inherit" | "pipe"; outFile?: string } = {}) {
  const result = spawnSync(cmd, args, {
    stdio: opts.stdio ?? "inherit",
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (exit ${result.status}): ${cmd} ${args.join(" ")}`);
  }
  return result;
}

function normalizeSqlIdentifier(identifier: string) {
  return identifier.trim().replace(/^"|"$/g, "").replace(/""/g, '"');
}

function splitSqlList(input: string) {
  const parts: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let depth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inSingleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        index += 1;
      } else if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"' && next === '"') {
        current += next;
        index += 1;
      } else if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts;
}

function splitInsertRows(valuesBlock: string) {
  const rows: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let depth = 0;

  for (let index = 0; index < valuesBlock.length; index += 1) {
    const char = valuesBlock[index];
    const next = valuesBlock[index + 1];

    if (inSingleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        index += 1;
      } else if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    current += char;

    if (depth === 0 && current.trim()) {
      rows.push(current.trim().replace(/,$/, ""));
      current = "";
      while (valuesBlock[index + 1] === "," || /\s/.test(valuesBlock[index + 1] ?? "")) {
        index += 1;
      }
    }
  }

  return rows;
}

function sanitizeProfilesInsertStatement(source: string) {
  const insertPattern =
    /INSERT INTO (?:"public"\.)?"corretor_studio_profiles" \(([\s\S]*?)\)\s+VALUES\s*\n([\s\S]*?);/m;
  const match = source.match(insertPattern);
  if (!match) return source;

  const [statement, rawColumns, rawRows] = match;
  const columns = splitSqlList(rawColumns);
  const keepIndexes = columns
    .map((column, index) => ({ column: normalizeSqlIdentifier(column), index }))
    .filter(({ column }) => !DROPPED_PROFILE_COLUMNS.has(column))
    .map(({ index }) => index);

  if (keepIndexes.length === columns.length) return source;

  const rows = splitInsertRows(rawRows).map((row) => {
    const trimmed = row.trim();
    const values = splitSqlList(trimmed.slice(1, -1));
    if (values.length !== columns.length) return row;
    return `\t(${keepIndexes.map((index) => values[index]).join(", ")})`;
  });

  const nextColumns = keepIndexes.map((index) => columns[index]).join(", ");
  const sanitizedStatement = `INSERT INTO "public"."corretor_studio_profiles" (${nextColumns}) VALUES\n${rows.join(",\n")};`;
  return source.replace(statement, sanitizedStatement);
}

function sanitizePublicDumpForLocalSchema() {
  const publicDumpPath = resolve(DUMP_DIR, "public.sql");
  if (!existsSync(publicDumpPath)) return;

  const source = readFileSync(publicDumpPath, "utf8");
  const sanitized = sanitizeProfilesInsertStatement(source);

  if (sanitized !== source) {
    writeFileSync(publicDumpPath, sanitized);
  }
}

function ensureDumpDir() {
  if (!existsSync(DUMP_DIR)) {
    mkdirSync(DUMP_DIR, { recursive: true });
  }
}

function dumpRemote() {
  for (const schema of SCHEMAS) {
    const outPath = resolve(DUMP_DIR, schema.file);
    step(`Dump remote schema "${schema.name}" → ${outPath}`);
    const args = ["db", "dump", "--linked", "--data-only", "-f", outPath];
    args.push("--schema", schema.name);
    run("supabase", args);
  }
  sanitizePublicDumpForLocalSchema();
}

function resetLocal() {
  step("Reset local Supabase DB (re-apply migrations)");
  run("supabase", ["db", "reset", "--local", "--no-seed"]);
}

function preparePublicRestore() {
  const sqlFile = resolve(DUMP_DIR, "prepare-public-restore.sql");
  writeFileSync(
    sqlFile,
    `DELETE FROM "public"."profile_user_types";
`
  );
  run("psql", [LOCAL_DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-f", sqlFile]);
}

function restoreLocal() {
  for (const schema of SCHEMAS) {
    const inPath = resolve(DUMP_DIR, schema.file);
    step(`Restore "${schema.name}" → local`);
    if (schema.name === "public") {
      preparePublicRestore();
    }
    // ON_ERROR_STOP=0 lets us tolerate FK warnings from circular constraints.
    run("psql", [LOCAL_DB_URL, "-v", "ON_ERROR_STOP=0", "-q", "-f", inPath]);
  }
}

function repairUserTypeAssignments() {
  step("Repair profile_user_type_assignments FK references");
  const sqlFile = resolve(DUMP_DIR, "repair-user-types.sql");
  writeFileSync(
    sqlFile,
    `UPDATE profile_user_type_assignments a
SET "userTypeId" = t.id
FROM profile_user_types t
WHERE t.slug = 'common'
  AND NOT EXISTS (SELECT 1 FROM profile_user_types pt WHERE pt.id = a."userTypeId");
`
  );
  run("psql", [LOCAL_DB_URL, "-v", "ON_ERROR_STOP=1", "-f", sqlFile]);
}

function cleanup() {
  if (keepDumps) {
    console.info(`\nKeeping dumps under ${DUMP_DIR} (passed --keep-dumps).`);
    return;
  }
  step("Cleanup dump files");
  rmSync(DUMP_DIR, { recursive: true, force: true });
}

async function main() {
  const started = Date.now();
  console.info("Cloning remote Supabase → local docker stack");
  ensureDumpDir();
  dumpRemote();
  resetLocal();
  restoreLocal();
  repairUserTypeAssignments();
  cleanup();
  const seconds = Math.round((Date.now() - started) / 1000);
  console.info(`\n✅ Done in ${seconds}s. Local DB now mirrors remote data.`);
}

main().catch((err) => {
  console.error("\n❌ Clone failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
