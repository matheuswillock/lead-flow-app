/**
 * Clone the linked remote Supabase database (data only) into the local stack.
 *
 * Flow:
 *  1. Dump data from remote for the `auth`, `storage` and `public` schemas.
 *  2. Reset the local Supabase DB so the schema matches the migrations head.
 *  3. Restore the dumps in order (auth → storage → public).
 *  4. Reconcile backoffice feature catalog via seed (remote dump may be stale).
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
import { resolvePostgresPassword } from "./lib/resolve-postgres-password";
import {
  LOCAL_DB_URL as CATALOG_LOCAL_DB_URL,
  syncBackofficeCatalog,
} from "./lib/sync-backoffice-catalog";

const LOCAL_DB_URL = CATALOG_LOCAL_DB_URL;
const DUMP_DIR = resolve(process.cwd(), "tmp", "db-clone");
const POST_CLONE_MIGRATIONS = [
  resolve(
    process.cwd(),
    "supabase",
    "migrations",
    "20260618211731_migrate-rafael-nogueira-to-pathos-seguros.sql",
  ),
];
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

function run(
  cmd: string,
  args: string[],
  opts: { stdio?: "inherit" | "pipe"; outFile?: string; env?: NodeJS.ProcessEnv } = {},
) {
  const result = spawnSync(cmd, args, {
    stdio: opts.stdio ?? "inherit",
    shell: process.platform === "win32",
    encoding: "utf8",
    env: opts.env ?? process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (exit ${result.status}): ${cmd} ${args.join(" ")}`);
  }
  return result;
}

function getSupabaseCliEnv(): NodeJS.ProcessEnv {
  const password = resolvePostgresPassword();
  return {
    ...process.env,
    SUPABASE_DISABLE_TELEMETRY: "1",
    DO_NOT_TRACK: "1",
    // Supabase CLI exige SUPABASE_DB_PASSWORD; mapeamos de POSTGRES_PASSWORD ou connection URL.
    ...(password ? { SUPABASE_DB_PASSWORD: password } : {}),
  };
}

function runSupabase(args: string[]) {
  run("supabase", args, { env: getSupabaseCliEnv() });
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
  const supabaseEnv = getSupabaseCliEnv();
  if (!supabaseEnv.SUPABASE_DB_PASSWORD) {
    console.warn(
      "\n⚠ Senha do Postgres remoto não encontrada — defina POSTGRES_PASSWORD ou DIRECT_URL/DATABASE_URL no .env.",
    );
  }

  for (const schema of SCHEMAS) {
    const outPath = resolve(DUMP_DIR, schema.file);
    step(`Dump remote schema "${schema.name}" → ${outPath}`);
    const args = ["db", "dump", "--linked", "--data-only", "-f", outPath, "--schema", schema.name];
    run("supabase", args, { env: supabaseEnv });
  }
  sanitizePublicDumpForLocalSchema();
}

function resetLocal() {
  step("Reset local Supabase DB (re-apply migrations)");
  runSupabase(["db", "reset", "--local", "--no-seed"]);
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

function reapplyPostCloneMigrations() {
  for (const migrationPath of POST_CLONE_MIGRATIONS) {
    step(`Reapply post-clone migration ${migrationPath}`);
    run("psql", [LOCAL_DB_URL, "-v", "ON_ERROR_STOP=1", "-f", migrationPath]);
  }
}

function repairBetaGrantFeatureIds() {
  const remoteDbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!remoteDbUrl) {
    console.warn("\n⚠ DIRECT_URL não definida — pulando reparo de grants beta.");
    return;
  }

  step("Repair beta grant featureId references (post-catalog seed)");
  const mappingResult = run(
    "psql",
    [
      remoteDbUrl,
      "-t",
      "-A",
      "-c",
      `SELECT g.id || E'\\t' || f.slug
       FROM backoffice_feature_grants g
       JOIN backoffice_features f ON f.id = g."featureId"
       WHERE g."grantType" = 'BETA';`,
    ],
    { stdio: "pipe" },
  );

  const lines = (mappingResult.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let repaired = 0;
  for (const line of lines) {
    const tabIndex = line.indexOf("\t");
    if (tabIndex === -1) continue;

    const grantId = line.slice(0, tabIndex).trim();
    const slug = line.slice(tabIndex + 1).trim();
    if (!grantId || !slug) continue;

    const escapedGrantId = grantId.replace(/'/g, "''");
    const escapedSlug = slug.replace(/'/g, "''");

    const updateResult = run(
      "psql",
      [
        LOCAL_DB_URL,
        "-t",
        "-A",
        "-c",
        `UPDATE backoffice_feature_grants AS g
         SET "featureId" = f.id,
             "updatedAt" = now()
         FROM backoffice_features AS f
         WHERE g.id = '${escapedGrantId}'
           AND f.slug = '${escapedSlug}';`,
      ],
      { stdio: "pipe" },
    );

    if ((updateResult.stdout ?? "").includes("UPDATE 1")) {
      repaired += 1;
    }
  }

  console.info(`[db:clone:remote] Beta grants reparados: ${repaired}/${lines.length}`);
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
  reapplyPostCloneMigrations();
  step("Sync backoffice feature catalog (post-clone seed)");
  syncBackofficeCatalog(LOCAL_DB_URL);
  repairBetaGrantFeatureIds();
  cleanup();
  const seconds = Math.round((Date.now() - started) / 1000);
  console.info(`\n✅ Done in ${seconds}s. Local DB now mirrors remote data.`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("\n❌ Clone failed:", message);
  if (message.includes("connection slots are reserved")) {
    console.error(
      "\nO Postgres remoto está sem conexões livres. Feche conexões extras, aguarde alguns minutos e tente de novo.",
    );
  }
  process.exit(1);
});
