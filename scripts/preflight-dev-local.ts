/**
 * Standalone preflight for local dev (clone check only).
 *
 * Prefer `bun run dev` or `bun run dev:local` — both use `scripts/dev-local.ts`,
 * which starts the local hybrid stack (Postgres + Realtime) + Evolution API +
 * Next.js with local env overrides.
 *
 * This script only runs the DB/clone portion (no Evolution, no Next.js).
 *
 * 1. Ensures the local hybrid stack is up (starts it if needed).
 * 2. Counts rows in `auth.users` on the local DB.
 * 3. If empty, runs `bun run db:clone:remote` so the dev session starts with
 *    a usable copy of remote data (auth + storage + public).
 *
 * Flags:
 *   --skip-clone  Do not auto-clone even if the DB is empty.
 *   --no-start    Fail fast if the local stack is not running.
 */

import { spawnSync } from "node:child_process";
import { LOCAL_DB_URL, probeLocalStack, startLocalStack, waitForLocalStack } from "./lib/local-stack";

const args = process.argv.slice(2);
const skipClone = args.includes("--skip-clone");
const noStart = args.includes("--no-start");

function step(label: string) {
  console.info(`\n▶ ${label}`);
}

function info(msg: string) {
  console.info(`  ${msg}`);
}

function fail(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function run(
  cmd: string,
  cmdArgs: string[],
  opts: { stdio?: "inherit" | "pipe" } = {},
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(cmd, cmdArgs, {
    stdio: opts.stdio ?? "pipe",
    shell: false,
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

async function ensureLocalStackRunning() {
  step("Checking local hybrid stack (Postgres + Realtime)");
  if (probeLocalStack()) {
    info("✓ Running");
    return;
  }
  if (noStart) {
    fail("Local stack is not running (--no-start passed).");
  }
  info("⚠ Not running — starting it (`bun run local:up`)…");
  const start = startLocalStack();
  if (start.status !== 0) {
    fail("`docker compose -f docker-compose.local.yml up -d` failed. Check Docker is running.");
  }
  info("  waiting for Postgres + proxy…");
  const ready = await waitForLocalStack();
  if (!ready) {
    fail("Local stack did not become ready in time.");
  }
  info("✓ Started");
}

function countAuthUsers(): number {
  const result = run("psql", [
    LOCAL_DB_URL,
    "-t",
    "-A",
    "-c",
    "SELECT count(*) FROM auth.users",
  ]);
  if (result.status !== 0) {
    fail(`Could not query local auth.users:\n${result.stderr || result.stdout}`);
  }
  const parsed = Number(result.stdout.trim());
  if (!Number.isFinite(parsed)) {
    fail(`Unexpected count output: "${result.stdout}"`);
  }
  return parsed;
}

function cloneRemote() {
  info("⚠ 0 users found — running `bun run db:clone:remote`…");
  const clone = run("bun", ["run", "db:clone:remote"], { stdio: "inherit" });
  if (clone.status !== 0) {
    info("⚠ Clone falhou — encerrando preflight sem dados remotos.");
    info("  Confira DIRECT_URL/DATABASE_URL no .env ou use `bun run dev -- --skip-clone`.");
    return;
  }
  info("✓ Clone done");
}

async function main() {
  await ensureLocalStackRunning();

  step("Checking local auth.users");
  const users = countAuthUsers();

  if (users > 0) {
    info(`✓ ${users} users present — DB is populated, skipping clone.`);
    return;
  }

  if (skipClone) {
    info("⚠ 0 users found, but --skip-clone passed. Continuing.");
    return;
  }

  cloneRemote();
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
