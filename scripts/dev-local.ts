/**
 * Local dev orchestrator: Supabase + Evolution API + Next.js.
 *
 * `bun run dev` and `bun run dev:local` are aliases — both use the local Docker
 * stack (not the remote DATABASE_URL from `.env`).
 *
 * Flags (preflight):
 *   --skip-clone  Do not auto-clone even if auth.users is empty.
 *   --no-start    Fail fast if Supabase local stack is not running.
 *   --skip-evo    Do not start Evolution API (WhatsApp unavailable).
 *   --turbo       Force Turbopack on Windows (default no Windows é Webpack por EPERM).
 *
 * Remaining args are forwarded to `next dev` (e.g. `--port 3001`).
 */

import "dotenv/config";

import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const LOCAL_EVO_API_URL = "http://127.0.0.1:8080";
const LOCAL_EVO_WEBHOOK_PUBLIC_URL = "http://host.docker.internal:3000";
const LOCAL_EVO_DEFAULT_API_KEY = "leadflow-local-evo-key";
const EVO_ENV_FILE = join(process.cwd(), ".env.evolution");
const EVO_ENV_EXAMPLE = join(process.cwd(), ".env.evolution.example");

const rawArgs = process.argv.slice(2);
const skipClone = rawArgs.includes("--skip-clone");
const noStart = rawArgs.includes("--no-start");
const skipEvo = rawArgs.includes("--skip-evo");
const forceTurbo = rawArgs.includes("--turbo") || rawArgs.includes("--turbopack");
const nextArgs = rawArgs.filter(
  (arg) =>
    arg !== "--skip-clone" &&
    arg !== "--no-start" &&
    arg !== "--skip-evo" &&
    arg !== "--turbo" &&
    arg !== "--turbopack",
);

type EnvOverrides = Partial<NodeJS.ProcessEnv>;

const supabaseEnv: EnvOverrides = {
  SUPABASE_DISABLE_TELEMETRY: "1",
  DO_NOT_TRACK: "1",
};

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
  opts: {
    stdio?: "inherit" | "pipe";
    env?: EnvOverrides;
  } = {},
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(cmd, cmdArgs, {
    stdio: opts.stdio ?? "pipe",
    shell: false,
    encoding: "utf8",
    env: {
      ...process.env,
      ...opts.env,
    },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runAsync(
  cmd: string,
  cmdArgs: string[],
  opts: {
    stdio?: "inherit" | "pipe";
    env?: EnvOverrides;
  } = {},
): Promise<{ status: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: opts.stdio ?? "pipe",
      shell: false,
      env: {
        ...process.env,
        ...opts.env,
      },
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
    }
    if (child.stderr) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
    }

    child.on("close", (code) => {
      resolve({
        status: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function bootstrapEvolutionEnv() {
  if (existsSync(EVO_ENV_FILE)) return;
  if (!existsSync(EVO_ENV_EXAMPLE)) {
    info("⚠ .env.evolution.example not found — `evo:up` may fail.");
    return;
  }
  copyFileSync(EVO_ENV_EXAMPLE, EVO_ENV_FILE);
  info("⚠ Created .env.evolution from .env.evolution.example");
}

function probeSupabase(): boolean {
  return run("supabase", ["status"], { env: supabaseEnv }).status === 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getEvolutionContainerStatus(): string | undefined {
  const result = run(
    "docker",
    ["inspect", "evolution_api", "--format", "{{.State.Status}}"],
    { stdio: "pipe" },
  );
  if (result.status !== 0) return undefined;
  return result.stdout.trim() || undefined;
}

function probeEvolution(): boolean {
  return run("curl", ["-sf", `${LOCAL_EVO_API_URL}/`], { stdio: "pipe" }).status === 0;
}

async function waitForEvolution(maxWaitMs = 90_000): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (probeEvolution()) return true;
    await sleep(2_000);
  }
  return false;
}

async function startSupabase(): Promise<void> {
  info("⚠ Supabase not running — starting (`supabase start`)…");
  const start = await runAsync("supabase", ["start"], {
    stdio: "inherit",
    env: supabaseEnv,
  });
  if (start.status !== 0) {
    fail("`supabase start` failed. Check Docker Desktop is running.");
  }
  info("✓ Supabase started");
}

async function startEvolution(): Promise<void> {
  bootstrapEvolutionEnv();
  info("⚠ Evolution API not reachable — starting (`bun run evo:up`)…");
  const start = await runAsync("bun", ["run", "evo:up"], { stdio: "inherit" });
  if (start.status !== 0) {
    info(
      "⚠ `evo:up` failed — continue without Evolution (WhatsApp connect will fail until stack is up).",
    );
    return;
  }

  info("  waiting for Evolution API on :8080…");
  const ready = await waitForEvolution();
  if (!ready) {
    const status = getEvolutionContainerStatus();
    if (status === "restarting") {
      info(
        "⚠ Evolution container is crash-looping (geralmente senha Postgres desatualizada no volume).",
      );
      info("  Rode `bun run evo:reset` e reinicie `bun dev`.");
    } else {
      info("⚠ Evolution API não respondeu — veja `bun run evo:logs`.");
    }
    return;
  }
  info("✓ Evolution API ready");
}

async function ensureLocalStacks(): Promise<void> {
  step("Checking local stacks (Supabase + Evolution)");

  const supabaseUp = probeSupabase();
  const evoUp = skipEvo ? true : probeEvolution();

  if (supabaseUp) {
    info("✓ Supabase running");
  } else if (noStart) {
    fail("Supabase local stack is not running (--no-start passed).");
  }

  if (skipEvo) {
    info("⊘ Evolution skipped (--skip-evo)");
  } else if (evoUp) {
    info("✓ Evolution API reachable");
  }

  const startTasks: Promise<void>[] = [];
  if (!supabaseUp) startTasks.push(startSupabase());
  if (!skipEvo && !evoUp) startTasks.push(startEvolution());

  if (startTasks.length > 0) {
    await Promise.all(startTasks);
  }
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
    info("⚠ Clone falhou — continuando sem dados remotos.");
    info("  Para corrigir: confira DIRECT_URL/DATABASE_URL no .env e rode `bun run db:clone:remote`.");
    info("  Para pular o clone automático: `bun run dev -- --skip-clone`.");
    return;
  }
  info("✓ Clone done");
}

async function runPreflight() {
  await ensureLocalStacks();

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

function parseSupabaseStatusEnv(stdout: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function getLocalDatabaseOverrides(): EnvOverrides {
  const status = run("supabase", ["status", "-o", "env"], { env: supabaseEnv });
  if (status.status !== 0) {
    info("⚠ Could not read `supabase status -o env` — using default local DB URL.");
    return {
      DATABASE_URL: LOCAL_DB_URL,
      DIRECT_URL: LOCAL_DB_URL,
    };
  }

  const parsed = parseSupabaseStatusEnv(status.stdout);
  const dbUrl = parsed.DB_URL ?? LOCAL_DB_URL;

  return {
    DATABASE_URL: dbUrl,
    DIRECT_URL: dbUrl,
    ...(parsed.API_URL ? { NEXT_PUBLIC_SUPABASE_URL: parsed.API_URL } : {}),
    ...(parsed.ANON_KEY ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: parsed.ANON_KEY } : {}),
    ...(parsed.SERVICE_ROLE_KEY
      ? { SUPABASE_SERVICE_ROLE_KEY: parsed.SERVICE_ROLE_KEY }
      : {}),
  };
}

function readEvolutionEnvValue(key: string): string | undefined {
  if (!existsSync(EVO_ENV_FILE)) return undefined;
  const content = readFileSync(EVO_ENV_FILE, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== key) continue;
    return trimmed.slice(eq + 1).trim();
  }
  return undefined;
}

function resolveLocalEvoApiKey(): string {
  const fromAppEnv = process.env.EVO_API_KEY?.trim();
  if (fromAppEnv) return fromAppEnv;
  return (
    readEvolutionEnvValue("AUTHENTICATION_API_KEY") ?? LOCAL_EVO_DEFAULT_API_KEY
  );
}

function getLocalEvoOverrides(): EnvOverrides {
  const evoBase = process.env.EVO_API_BASE_URL?.replace(/\/$/, "");
  const isLocalEvo =
    !evoBase ||
    evoBase === LOCAL_EVO_API_URL ||
    evoBase === "http://localhost:8080";

  if (!isLocalEvo) return {};

  return {
    EVO_API_BASE_URL: evoBase ?? LOCAL_EVO_API_URL,
    EVO_API_KEY: resolveLocalEvoApiKey(),
    ...(process.env.EVO_WEBHOOK_PUBLIC_URL
      ? {}
      : { EVO_WEBHOOK_PUBLIC_URL: LOCAL_EVO_WEBHOOK_PUBLIC_URL }),
  };
}

function buildNextDevArgs(): string[] {
  const args = ["dev"];
  if (process.platform === "win32" && !forceTurbo) {
    args.push("--webpack");
  }
  args.push(...nextArgs);
  return args;
}

function startNextDev(): never {
  const localOverrides = {
    ...getLocalDatabaseOverrides(),
    ...getLocalEvoOverrides(),
  };

  step("Starting Next.js with local database overrides");
  info(`DATABASE_URL → ${localOverrides.DATABASE_URL ?? LOCAL_DB_URL}`);
  if (localOverrides.EVO_API_BASE_URL) {
    info(`EVO_API_BASE_URL → ${localOverrides.EVO_API_BASE_URL}`);
  }
  if (process.platform === "win32" && !forceTurbo) {
    info("Windows: usando Webpack no dev (evita EPERM do Turbopack). Use --turbo para forçar Turbopack.");
  }

  const nextBin = join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const result = spawnSync(process.execPath, [nextBin, ...buildNextDevArgs()], {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...localOverrides,
    },
  });

  if (result.error) {
    fail(`Failed to start Next.js: ${result.error.message}`);
  }

  process.exit(result.status ?? 1);
}

async function main() {
  try {
    await runPreflight();
    startNextDev();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

void main();
