/**
 * Standalone preflight for local dev (seed/clone check only).
 *
 * Prefer `bun run dev` or `bun run dev:local` — both usam `scripts/dev-local.ts`,
 * que sobe o Postgres local (db-only) + Next.js com overrides locais.
 *
 * This script only runs the DB/seed portion (no Evolution, no Next.js).
 *
 * 1. Ensures the local Postgres is up (starts it if needed).
 * 2. Se o catálogo estiver vazio, roda `bun run db:seed:local`.
 * 3. `--clone` dispara o dump remoto. `--skip-clone` não popula.
 *
 * Flags:
 *   --clone       Dump remoto no lugar do seed.
 *   --skip-clone  Do not auto-populate.
 *   --no-start    Fail fast if the local stack is not running.
 */

import { spawnSync } from "node:child_process";
import { LOCAL_DB_URL, probeLocalStack, startLocalStack, waitForLocalStack } from "./lib/local-stack";
import {
  countActiveBackofficeFeatures,
  EXPECTED_ACTIVE_BACKOFFICE_FEATURES,
} from "./lib/sync-backoffice-catalog";

const args = process.argv.slice(2);
const skipClone = args.includes("--skip-clone");
const shouldClone = args.includes("--clone");
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
  step("Checking local Postgres (db-only)");
  if (probeLocalStack("db-only")) {
    info("✓ Running");
    return;
  }
  if (noStart) {
    fail("Local stack is not running (--no-start passed).");
  }
  info("⚠ Not running — starting it (`bun run local:up`)…");
  const start = startLocalStack("db-only");
  if (start.status !== 0) {
    fail(
      "`docker compose` falhou. No Fedora/Podman: `systemctl --user restart podman.socket`. Confira também se o Podman/Docker está no ar.",
    );
  }
  info("  waiting for Postgres…");
  const ready = await waitForLocalStack("db-only");
  if (!ready) {
    fail("Local stack did not become ready in time.");
  }
  info("✓ Started");
}

function needsLocalSeed(): boolean {
  try {
    return countActiveBackofficeFeatures(LOCAL_DB_URL) < EXPECTED_ACTIVE_BACKOFFICE_FEATURES;
  } catch {
    return true;
  }
}

function seedLocal() {
  info("⚠ Banco local vazio/incompleto — running `bun run db:seed:local`…");
  const seed = run("bun", ["run", "db:seed:local"], { stdio: "inherit" });
  if (seed.status !== 0) {
    info("⚠ Seed local falhou. Rode `bun run db:seed:local` manualmente.");
    return;
  }
  info("✓ Seed local concluído");
}

function cloneRemote() {
  info("⚠ --clone — running `bun run db:clone:remote`…");
  const clone = run("bun", ["run", "db:clone:remote"], { stdio: "inherit" });
  if (clone.status !== 0) {
    info("⚠ Clone falhou — encerrando preflight sem dados remotos.");
    info("  Confira DIRECT_URL/DATABASE_URL no .env ou use `bun run dev -- --skip-clone`.");
    return;
  }
  info("✓ Clone done");
}

async function main() {
  if (shouldClone && skipClone) {
    fail("Cannot pass --clone and --skip-clone at the same time.");
  }

  await ensureLocalStackRunning();

  if (skipClone) {
    step("Skipping auto-populate (--skip-clone)");
    return;
  }

  if (shouldClone) {
    step("Cloning remote into local Postgres (--clone)");
    cloneRemote();
    return;
  }

  step("Checking local catalog (seed, not clone)");
  if (!needsLocalSeed()) {
    info("✓ Catálogo local já populado — pulando seed.");
    return;
  }
  seedLocal();
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
