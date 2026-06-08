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
const PROFILE_TABLE_INSERT = 'INSERT INTO "public"."corretor_studio_profiles"';
const LEGACY_BACKOFFICE_SUBSCRIPTIONS_TABLE = '"public"."backoffice_user_subscriptions"';
const CURRENT_BACKOFFICE_SUBSCRIPTIONS_TABLE =
  '"public"."backoffice_user_product_subscriptions"';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function ensureDumpDir() {
  if (!existsSync(DUMP_DIR)) {
    mkdirSync(DUMP_DIR, { recursive: true });
  }
}

function dumpRemote() {
  for (const schema of SCHEMAS) {
    const outPath = resolve(DUMP_DIR, schema.file);
    step(`Dump remote schema "${schema.name}" → ${outPath}`);
    const args = ["db", "dump", "--linked", "--data-only", "-f", outPath, "--schema", schema.name];
    run("supabase", args);
  }
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function decodeSqlLiteral(token: string): string | null {
  const trimmed = token.trim();
  if (trimmed === "NULL") {
    return null;
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

function encodeSqlLiteral(value: string | null): string {
  if (value === null) {
    return "NULL";
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function splitSqlTuples(block: string) {
  const tuples: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;

  for (let i = 0; i < block.length; i += 1) {
    const char = block[i];
    const next = block[i + 1];

    current += char;

    if (char === "'") {
      if (inString && next === "'") {
        current += next;
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        tuples.push(current.trim());
        current = "";
      }
    }
  }

  return tuples.filter(Boolean);
}

function splitTupleValues(tuple: string) {
  const inner = tuple.trim().slice(1, -1);
  const values: string[] = [];
  let current = "";
  let inString = false;

  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];
    const next = inner[i + 1];

    if (char === "'") {
      current += char;
      if (inString && next === "'") {
        current += next;
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (char === "," && !inString) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    values.push(current.trim());
  }

  return values;
}

function normalizeProfileInsert(sql: string) {
  const insertStart = sql.indexOf(PROFILE_TABLE_INSERT);
  if (insertStart < 0) {
    return sql;
  }

  const columnsStart = sql.indexOf("(", insertStart);
  const columnsEnd = sql.indexOf(") VALUES", columnsStart);
  const statementEnd = sql.indexOf(";\n\n", columnsEnd);

  if (columnsStart < 0 || columnsEnd < 0 || statementEnd < 0) {
    throw new Error("Could not parse corretor_studio_profiles dump statement");
  }

  const columns = sql
    .slice(columnsStart + 1, columnsEnd)
    .split(",")
    .map((column) => column.trim().replaceAll('"', ""));

  const subscriptionIdIndex = columns.indexOf("subscriptionId");
  const asaasSubscriptionIdIndex = columns.indexOf("asaasSubscriptionId");

  if (subscriptionIdIndex < 0 || asaasSubscriptionIdIndex < 0) {
    return sql;
  }

  const valuesBlock = sql.slice(columnsEnd + ") VALUES".length, statementEnd).trim();
  const tuples = splitSqlTuples(valuesBlock);

  const normalizedTuples = tuples.map((tuple) => {
    const values = splitTupleValues(tuple);
    const subscriptionId = decodeSqlLiteral(values[subscriptionIdIndex]);
    const asaasSubscriptionId = decodeSqlLiteral(values[asaasSubscriptionIdIndex]);

    if (subscriptionId && !isUuid(subscriptionId)) {
      values[subscriptionIdIndex] = "NULL";
      values[asaasSubscriptionIdIndex] = encodeSqlLiteral(
        asaasSubscriptionId && asaasSubscriptionId.length > 0
          ? asaasSubscriptionId
          : subscriptionId,
      );
    }

    return `\t(${values.join(", ")})`;
  });

  const rebuiltStatement =
    `${sql.slice(insertStart, columnsEnd + ") VALUES".length)}\n` +
    `${normalizedTuples.join(",\n")};\n\n`;

  return `${sql.slice(0, insertStart)}${rebuiltStatement}${sql.slice(statementEnd + 3)}`;
}

function normalizePublicDump() {
  const publicDumpPath = resolve(DUMP_DIR, "public.sql");
  let sql = readFileSync(publicDumpPath, "utf8");

  sql = sql.replaceAll(
    LEGACY_BACKOFFICE_SUBSCRIPTIONS_TABLE,
    CURRENT_BACKOFFICE_SUBSCRIPTIONS_TABLE,
  );
  sql = normalizeProfileInsert(sql);

  writeFileSync(publicDumpPath, sql, "utf8");
}

function resetLocal() {
  step("Reset local Supabase DB (re-apply migrations)");
  run("supabase", ["db", "reset", "--local", "--no-seed"]);
}

function prepareLocalForPublicRestore() {
  step("Prepare local public schema for restore");
  run("psql", [
    LOCAL_DB_URL,
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
    "-c",
    [
      'TRUNCATE TABLE public.profile_user_type_assignments RESTART IDENTITY CASCADE;',
      'TRUNCATE TABLE public.profile_user_types RESTART IDENTITY CASCADE;',
    ].join(" "),
  ]);
}

function restoreLocal() {
  for (const schema of SCHEMAS) {
    const inPath = resolve(DUMP_DIR, schema.file);
    if (schema.name === "public") {
      prepareLocalForPublicRestore();
    }
    step(`Restore "${schema.name}" → local`);
    run("psql", [LOCAL_DB_URL, "-v", "ON_ERROR_STOP=1", "-q", "-f", inPath]);
  }
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
  normalizePublicDump();
  resetLocal();
  restoreLocal();
  cleanup();
  const seconds = Math.round((Date.now() - started) / 1000);
  console.info(`\n✅ Done in ${seconds}s. Local DB now mirrors remote data.`);
}

main().catch((err) => {
  console.error("\n❌ Clone failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
