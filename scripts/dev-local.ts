/**
 * Local dev orchestrator: local DB stack + optional local stacks + Next.js.
 *
 * `bun run dev` e `bun run dev:local` sobem Postgres local (:55322) e o Next,
 * com Auth/Storage do `.env` remoto (modo db-only). Não usam o DATABASE_URL
 * remoto. Realtime fica desligado. Para tempo real local: `--hybrid`. Para o
 * stack completo (`supabase start`): `--full-supabase`.
 *
 * Optional stacks:
 *   n8n        Start N8N (Bethânia workflows).
 *   evolution  Start Evolution API (WhatsApp).
 *   total      Start N8N + Evolution API.
 *
 * Examples:
 *   bun dev
 *   bun dev -- n8n
 *   bun dev -- --hybrid
 *   bun dev -- --full-supabase
 *   bun dev -- --clone
 *   bun dev -- --remote-db
 *
 * Flags:
 *   --db-only        Padrão: só Postgres local (explícito, idempotente).
 *   --hybrid         Postgres + Realtime + Caddy (exige `.env.local-stack`).
 *   --full-supabase  `supabase start` (Auth/Storage/Studio locais).
 *   --remote-db      Sem Docker e sem overrides: o Next usa o DATABASE_URL do
 *                    `.env` (BANCO REMOTO — leituras e escritas reais).
 *   --clone          Dump remoto no lugar do seed local.
 *   --skip-clone     Não auto-popular nem tocar no banco (pula migrations,
 *                    seed e usuário local automáticos).
 *   --no-start       Fail fast if the local stack is not running.
 *   --skip-evo       Legacy: keep Evolution API disabled.
 *   --skip-n8n       Legacy: keep N8N disabled.
 *   --turbo          Force Turbopack on Windows (default no Windows é Webpack por EPERM).
 *
 * Preflight (db-only/hybrid): aplica migrations pendentes no Postgres local e,
 * se não houver Profile e LOCAL_DEV_USER_EMAIL/LOCAL_DEV_USER_PASSWORD
 * estiverem no `.env`, cria o usuário sintético de teste
 * (`db:seed:local -- --local-user`).
 *
 * Remaining args are forwarded to `next dev` (e.g. `--port 3001`).
 */

import "dotenv/config";

import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyAuthStubSchema,
  applyPendingLocalMigrations,
  countPendingLocalMigrations,
  LOCAL_DB_URL,
  LOCAL_PROXY_URL,
  type LocalStackMode,
  probeLocalStack,
  readRemoteStackOverrides,
  startLocalStack,
  waitForLocalStack,
} from "./lib/local-stack";
import {
  ensureBackofficeCatalog,
  EXPECTED_ACTIVE_BACKOFFICE_FEATURES,
  countActiveBackofficeFeatures,
} from "./lib/sync-backoffice-catalog";
import { parseDevLocalArgs } from "./dev-local-options";

const LOCAL_EVO_API_URL = "http://127.0.0.1:8080";
const LOCAL_EVO_WEBHOOK_PUBLIC_URL = "http://host.docker.internal:3000";
const LOCAL_EVO_DEFAULT_API_KEY = "leadflow-local-evo-key";
const LOCAL_N8N_URL = "http://127.0.0.1:5678";
const N8N_ENV_FILE = join(process.cwd(), ".env.n8n");
const N8N_ENV_EXAMPLE = join(process.cwd(), ".env.n8n.example");
const EVO_ENV_FILE = join(process.cwd(), ".env.evolution");
const EVO_ENV_EXAMPLE = join(process.cwd(), ".env.evolution.example");

const rawArgs = process.argv.slice(2);
const devOptions = parseDevLocalArgs(rawArgs);
const {
  skipClone,
  clone: shouldClone,
  noStart,
  forceTurbo,
  fullSupabase,
  remoteDb,
  stackMode,
  startEvolution: shouldStartEvolution,
  startN8n: shouldStartN8n,
  nextArgs,
} = devOptions;

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

function bootstrapN8nEnv() {
  if (existsSync(N8N_ENV_FILE)) return;
  if (!existsSync(N8N_ENV_EXAMPLE)) {
    info("⚠ .env.n8n.example not found — `n8n:up` may fail.");
    return;
  }
  copyFileSync(N8N_ENV_EXAMPLE, N8N_ENV_FILE);
  info("⚠ Created .env.n8n from .env.n8n.example");
}

function readN8nEnvValue(key: string): string | undefined {
  if (!existsSync(N8N_ENV_FILE)) return undefined;
  const content = readFileSync(N8N_ENV_FILE, "utf8");
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

/** Legado — usado somente com --full-supabase. */
function probeFullSupabase(): boolean {
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

/** Legado — usado somente com --full-supabase. */
async function startFullSupabase(): Promise<void> {
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

function composeStackLabel(mode: LocalStackMode): string {
  return mode === "hybrid" ? "Postgres + Realtime" : "Postgres (db-only)";
}

async function startComposeLocalStack(mode: LocalStackMode): Promise<void> {
  const upHint = mode === "hybrid" ? "`bun run local:up:hybrid`" : "`bun run local:up`";
  info(`⚠ Local stack not running — starting (${upHint})…`);
  const start = startLocalStack(mode);
  if (start.status !== 0) {
    fail(
      "`docker compose` falhou. No Fedora/Podman: `systemctl --user restart podman.socket`. Confira também se o Podman/Docker está no ar.",
    );
  }
  info(mode === "hybrid" ? "  waiting for Postgres + proxy…" : "  waiting for Postgres…");
  const ready = await waitForLocalStack(mode);
  if (!ready) {
    fail("Local stack did not become ready in time. Veja `bun run local:logs`.");
  }
  info("✓ Local stack started");
}

function ensureN8nDockerNetwork(): boolean {
  const inspect = run("docker", ["network", "inspect", "n8n-net"], { stdio: "pipe" });
  if (inspect.status === 0) return true;

  info("⚠ Docker network n8n-net not found — creating it for Evolution…");
  const create = run("docker", ["network", "create", "n8n-net"], { stdio: "inherit" });
  if (create.status === 0) {
    info("✓ Docker network n8n-net ready");
    return true;
  }

  info("⚠ Could not create Docker network n8n-net — Evolution may fail to start.");
  return false;
}

async function startEvolution(): Promise<void> {
  bootstrapEvolutionEnv();
  ensureN8nDockerNetwork();
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
        "⚠ Evolution container is crash-looping (geralmente DATABASE_* inválido no .env.evolution ou Supabase inacessível).",
      );
      info("  Confira senha/URIs Supabase em .env.evolution, rode `bun run evo:reset` e reinicie `bun dev`.");
    } else {
      info("⚠ Evolution API não respondeu — veja `bun run evo:logs`.");
    }
    return;
  }
  info("✓ Evolution API ready");
}

function probeN8n(): boolean {
  return run("curl", ["-sf", `${LOCAL_N8N_URL}/healthz`], { stdio: "pipe" }).status === 0;
}

async function waitForN8n(maxWaitMs = 90_000): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (probeN8n()) return true;
    await sleep(2_000);
  }
  return false;
}

async function startN8n(): Promise<void> {
  bootstrapN8nEnv();
  info("⚠ N8N not reachable — starting (`bun run n8n:up`)…");
  const start = await runAsync("bun", ["run", "n8n:up"], { stdio: "inherit" });
  if (start.status !== 0) {
    info("⚠ `n8n:up` failed — continue without N8N (Bethânia workflows unavailable).");
    return;
  }

  info("  waiting for N8N on :5678…");
  const ready = await waitForN8n();
  if (!ready) {
    info("⚠ N8N não respondeu — veja `bun run n8n:logs`.");
    return;
  }
  info("✓ N8N ready");
}


async function ensureLocalStacks(): Promise<void> {
  const optionalStacks = [
    shouldStartN8n ? "N8N" : undefined,
    shouldStartEvolution ? "Evolution" : undefined,
  ].filter(Boolean);
  const dbStackLabel = fullSupabase ? "Supabase (full)" : composeStackLabel(stackMode);

  step(
    optionalStacks.length > 0
      ? `Checking local stacks (${dbStackLabel} + ${optionalStacks.join(" + ")})`
      : `Checking local stacks (${dbStackLabel} only)`,
  );

  const dbStackUp = fullSupabase ? probeFullSupabase() : probeLocalStack(stackMode);
  const evoUp = shouldStartEvolution ? probeEvolution() : true;
  const n8nUp = shouldStartN8n ? probeN8n() : true;

  if (dbStackUp) {
    info(`✓ ${dbStackLabel} running`);
  } else if (noStart) {
    fail(`${dbStackLabel} local stack is not running (--no-start passed).`);
  }

  if (!shouldStartEvolution) {
    info("⊘ Evolution skipped (use `bun dev -- evolution` or `bun dev -- total`)");
  } else if (evoUp) {
    info("✓ Evolution API reachable");
  }

  if (!shouldStartN8n) {
    info("⊘ N8N skipped (use `bun dev -- n8n` or `bun dev -- total`)");
  } else if (n8nUp) {
    info("✓ N8N reachable");
  }

  const startTasks: Promise<void>[] = [];
  if (!dbStackUp) startTasks.push(fullSupabase ? startFullSupabase() : startComposeLocalStack(stackMode));
  if (shouldStartN8n && !n8nUp) startTasks.push(startN8n());

  if (startTasks.length > 0) {
    await Promise.all(startTasks);
  }

  if (shouldStartEvolution && !evoUp) {
    await startEvolution();
  }
}

function cloneRemote() {
  info("⚠ --clone — running `bun run db:clone:remote`…");
  const clone = run("bun", ["run", "db:clone:remote"], { stdio: "inherit" });
  if (clone.status !== 0) {
    info("⚠ Clone falhou — continuando sem dados remotos.");
    info("  Para corrigir: confira DIRECT_URL/DATABASE_URL no .env e rode `bun run db:clone:remote`.");
    info("  Para pular o populate automático: `bun run dev -- --skip-clone`.");
    return;
  }
  info("✓ Clone done");
}

function countLocalProfiles(dbUrl: string): number | null {
  const result = run("psql", [
    dbUrl,
    "-t",
    "-A",
    "-c",
    'SELECT count(*) FROM "public"."corretor_studio_profiles"',
  ]);
  if (result.status !== 0) return null;
  const parsed = Number(result.stdout.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function needsLocalSeed(dbUrl: string): boolean {
  try {
    return countActiveBackofficeFeatures(dbUrl) < EXPECTED_ACTIVE_BACKOFFICE_FEATURES;
  } catch {
    return true;
  }
}

function seedLocalIfNeeded(dbUrl: string) {
  if (!needsLocalSeed(dbUrl)) {
    info("✓ Catálogo local já populado — pulando seed.");
    ensureBackofficeCatalogSynced(dbUrl);
    return;
  }

  info("⚠ Banco local vazio/incompleto — rodando `bun run db:seed:local`…");
  const seed = run("bun", ["run", "db:seed:local"], {
    stdio: "inherit",
    env: { DATABASE_URL: dbUrl, DIRECT_URL: dbUrl },
  });
  if (seed.status !== 0) {
    info("⚠ Seed local falhou. Rode `bun run db:seed:local` manualmente.");
    return;
  }
  info("✓ Seed local concluído");
}

/**
 * Drift de migrations no Postgres local vira P2022 em toda tela e parece bug
 * de aplicação — o banco local é descartável, então o preflight aplica sozinho.
 */
function ensureLocalMigrations(dbUrl: string) {
  step("Checking local migrations");
  const pending = countPendingLocalMigrations(dbUrl);
  if (pending === null) {
    info("⚠ Não foi possível checar migrations locais — seguindo sem aplicar.");
    return;
  }
  if (pending === 0) {
    info("✓ Migrations locais em dia");
    return;
  }

  info(`⚠ ${pending} migration(s) pendente(s) no Postgres local — aplicando…`);
  if (!applyAuthStubSchema()) {
    fail("Stub de auth local falhou. Confira o Postgres :55322 e rode `bun run db:seed:local`.");
  }
  if (!applyPendingLocalMigrations()) {
    fail("`db:migrate:apply:local` falhou — não vou subir o Next com o schema quebrado. Veja o SQL acima.");
  }
  info("✓ Migrations locais aplicadas");
}

function ensureLocalDevProfile(dbUrl: string) {
  const count = countLocalProfiles(dbUrl);
  if (count !== 0) return;

  const email = process.env.LOCAL_DEV_USER_EMAIL?.trim();
  const password = process.env.LOCAL_DEV_USER_PASSWORD?.trim();
  if (email && password) {
    info(`⚠ Nenhum Profile local — criando usuário de teste ${email} (--local-user)…`);
    const seed = run("bun", ["run", "db:seed:local", "--", "--local-user"], {
      stdio: "inherit",
      env: { DATABASE_URL: dbUrl, DIRECT_URL: dbUrl },
    });
    if (seed.status !== 0) {
      info("⚠ Criação do usuário de teste falhou. Rode `bun run db:seed:local -- --local-user` manualmente.");
      return;
    }
    info(`✓ Usuário de teste pronto — login: ${email} (senha do .env).`);
    return;
  }

  info("⚠ Nenhum Profile local. Login no Auth remoto funciona, mas o app não acha o Profile.");
  info("  Usuário de teste: defina LOCAL_DEV_USER_EMAIL e LOCAL_DEV_USER_PASSWORD no .env");
  info("  e rode `bun run db:seed:local -- --local-user` (ou só reinicie `bun run dev`).");
  info("  Conta real (para dados clonados): bun run db:seed:local -- --link-remote-user voce@email");
}

async function runPreflight() {
  await ensureLocalStacks();
  const dbUrl = resolveActiveDbUrl();

  if (skipClone) {
    step("Skipping auto-populate (--skip-clone)");
    info("⊘ Nem migrations, nem seed local, nem clone remoto.");
    return;
  }

  if (shouldClone) {
    step("Cloning remote into local Postgres (--clone)");
    if (fullSupabase) {
      info("⚠ `db:clone:remote` só popula o Postgres :55322 — pulando clone automático em --full-supabase.");
    } else {
      // O clone faz o próprio `supabase db reset` — não precisa do auto-migrate.
      cloneRemote();
    }
    ensureBackofficeCatalogSynced(dbUrl);
    ensureLocalDevProfile(dbUrl);
    return;
  }

  if (fullSupabase) {
    step("Checking local catalog (--full-supabase)");
    ensureBackofficeCatalogSynced(dbUrl);
    return;
  }

  ensureLocalMigrations(dbUrl);
  step("Checking local catalog (seed, not clone)");
  seedLocalIfNeeded(dbUrl);
  ensureLocalDevProfile(dbUrl);
}

function ensureBackofficeCatalogSynced(dbUrl: string) {
  try {
    const synced = ensureBackofficeCatalog(dbUrl);
    if (synced) {
      info(
        `✓ Catálogo backoffice sincronizado (${EXPECTED_ACTIVE_BACKOFFICE_FEATURES} features ativas).`,
      );
    }
  } catch (err) {
    info(
      `⚠ Falha ao sincronizar catálogo backoffice: ${err instanceof Error ? err.message : String(err)}`,
    );
    info(`  Rode manualmente: DATABASE_URL=${dbUrl} bun run db:seed:backoffice-products`);
  }
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

/** Legado — usado somente com --full-supabase. Cacheia para evitar `supabase status` repetido. */
let cachedFullSupabaseStatusEnv: Record<string, string> | null = null;
function getFullSupabaseStatusEnv(): Record<string, string> {
  if (cachedFullSupabaseStatusEnv) return cachedFullSupabaseStatusEnv;
  const status = run("supabase", ["status", "-o", "env"], { env: supabaseEnv });
  cachedFullSupabaseStatusEnv = status.status === 0 ? parseSupabaseStatusEnv(status.stdout) : {};
  return cachedFullSupabaseStatusEnv;
}

/**
 * DB URL do modo ativo — supabase/config.toml usa [db].port != 55322 (evita
 * conflito com o Postgres do stack híbrido em docker-compose.local.yml), então
 * em --full-supabase o DB real de `supabase start` NÃO é LOCAL_DB_URL.
 */
function resolveActiveDbUrl(): string {
  if (!fullSupabase) return LOCAL_DB_URL;
  const parsed = getFullSupabaseStatusEnv();
  if (!parsed.DB_URL) {
    info("⚠ Could not read `supabase status -o env` — usando LOCAL_DB_URL como fallback (pode estar incorreto).");
    return LOCAL_DB_URL;
  }
  return parsed.DB_URL;
}

/** Legado — usado somente com --full-supabase (Auth/Storage/Studio locais). */
function getFullSupabaseDatabaseOverrides(): EnvOverrides {
  const parsed = getFullSupabaseStatusEnv();
  if (!parsed.DB_URL) {
    info("⚠ Could not read `supabase status -o env` — using default local DB URL.");
    return {
      DATABASE_URL: LOCAL_DB_URL,
      DIRECT_URL: LOCAL_DB_URL,
    };
  }

  const dbUrl = parsed.DB_URL;

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

/**
 * db-only (padrão): Postgres local para dados; Auth/Storage/anon/service role
 * vêm do `.env` remoto (já carregado por dotenv). Sem proxy, sem Realtime.
 */
function getDbOnlyDatabaseOverrides(): EnvOverrides {
  return {
    DATABASE_URL: LOCAL_DB_URL,
    DIRECT_URL: LOCAL_DB_URL,
    SUPABASE_LOCAL_DB_ONLY: "true",
    NEXT_PUBLIC_REALTIME_DISABLED: "true",
  };
}

/**
 * Stack híbrido: Postgres local para dados, proxy local (Caddy) para
 * Auth/Storage remotos + Realtime local — tudo atrás de uma única
 * NEXT_PUBLIC_SUPABASE_URL, como o supabase-js espera.
 */
function getHybridDatabaseOverrides(): EnvOverrides {
  const remote = readRemoteStackOverrides();
  if (!remote.SUPABASE_REMOTE_ANON_KEY || !remote.SUPABASE_REMOTE_SERVICE_ROLE_KEY) {
    info(
      "⚠ docker/local/.env.local-stack incompleto — Auth/Storage remotos podem falhar (faltam ANON_KEY/SERVICE_ROLE_KEY).",
    );
  }

  return {
    DATABASE_URL: LOCAL_DB_URL,
    DIRECT_URL: LOCAL_DB_URL,
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_PROXY_URL,
    // Marcador explícito para createSupabaseAdmin() (lib/supabase/server.ts)
    // distinguir o proxy híbrido (Auth/Storage remotos) do --full-supabase
    // (Auth/Storage locais de verdade), já que ambos usam 127.0.0.1.
    SUPABASE_HYBRID_LOCAL_STACK: "true",
    ...(remote.SUPABASE_REMOTE_ANON_KEY
      ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: remote.SUPABASE_REMOTE_ANON_KEY }
      : {}),
    ...(remote.SUPABASE_REMOTE_SERVICE_ROLE_KEY
      ? { SUPABASE_SERVICE_ROLE_KEY: remote.SUPABASE_REMOTE_SERVICE_ROLE_KEY }
      : {}),
    // Repassa o opt-in (default: bloqueado) para createSupabaseAdmin() — ver
    // docker/local/.env.local-stack.example.
    ...(remote.SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN
      ? { SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN: remote.SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN }
      : {}),
  };
}

function getLocalDatabaseOverrides(): EnvOverrides {
  if (fullSupabase) return getFullSupabaseDatabaseOverrides();
  if (stackMode === "hybrid") return getHybridDatabaseOverrides();
  return getDbOnlyDatabaseOverrides();
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


function getLocalN8nOverrides(): EnvOverrides {
  const n8nBase = process.env.N8N_BASE_URL?.replace(/\/$/, "");
  const isLocalN8n =
    !n8nBase ||
    n8nBase === LOCAL_N8N_URL ||
    n8nBase === "http://localhost:5678";

  if (!isLocalN8n) return {};

  const webhookSecret =
    process.env.BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET?.trim() ??
    readN8nEnvValue("BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET") ??
    "leadflow-local-studio-bot-secret";

  return {
    N8N_BASE_URL: n8nBase ?? LOCAL_N8N_URL,
    N8N_WEBHOOK_BASE_URL:
      process.env.N8N_WEBHOOK_BASE_URL ??
      readN8nEnvValue("N8N_WEBHOOK_BASE_URL") ??
      "http://host.docker.internal:5678",
    BACKOFFICE_N8N_OUTBOUND_URL:
      process.env.BACKOFFICE_N8N_OUTBOUND_URL?.trim() ??
      `${n8nBase ?? LOCAL_N8N_URL}/webhook/bethania-outbound`,
    BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET: webhookSecret,
    N8N_BETHANIA_INBOUND_PATH:
      process.env.N8N_BETHANIA_INBOUND_PATH ??
      readN8nEnvValue("N8N_BETHANIA_INBOUND_PATH") ??
      "/webhook/bethania-inbound",
    EVO_BETHANIA_INSTANCE: process.env.EVO_BETHANIA_INSTANCE ?? "bethania",
  };
}

function maskedDbHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "(DATABASE_URL ilegível)";
  }
}

function assertRemoteDbEnv(): void {
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    fail("--remote-db exige DATABASE_URL e DIRECT_URL no `.env` (apontando para o banco remoto).");
  }
}

function printRemoteDbBanner(): void {
  const host = maskedDbHost(process.env.DATABASE_URL ?? "");
  console.error("\n⚠️⚠️⚠️  MODO REMOTO (--remote-db)  ⚠️⚠️⚠️");
  console.error(`   Leituras E ESCRITAS vão para o banco REMOTO: ${host}`);
  console.error("   Sem Docker, sem migrations, sem seed, sem usuário de teste.");
  console.error("   Dados alterados aqui são dados REAIS.\n");
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
  // --remote-db: nenhum override — o Next herda o `.env` como está (remoto).
  const localOverrides: EnvOverrides = remoteDb
    ? {}
    : {
        ...getLocalDatabaseOverrides(),
        ...getLocalEvoOverrides(),
        ...getLocalN8nOverrides(),
      };

  if (remoteDb) {
    printRemoteDbBanner();
    step("Starting Next.js against the REMOTE database (.env as-is)");
    info(`DATABASE_URL → ${maskedDbHost(process.env.DATABASE_URL ?? "")}`);
  } else {
    step("Starting Next.js with local database overrides");
    info(`DATABASE_URL → ${localOverrides.DATABASE_URL ?? LOCAL_DB_URL}`);
  }
  if (localOverrides.SUPABASE_LOCAL_DB_ONLY === "true") {
    info("Realtime desligado (db-only). Use `bun dev -- --hybrid` para tempo real.");
    info(`NEXT_PUBLIC_SUPABASE_URL → ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(do .env)"}`);
  }
  if (localOverrides.NEXT_PUBLIC_SUPABASE_URL) {
    info(`NEXT_PUBLIC_SUPABASE_URL → ${localOverrides.NEXT_PUBLIC_SUPABASE_URL}`);
  }
  if (localOverrides.EVO_API_BASE_URL) {
    info(`EVO_API_BASE_URL → ${localOverrides.EVO_API_BASE_URL}`);
  }
  if (localOverrides.N8N_BASE_URL) {
    info(`N8N_BASE_URL → ${localOverrides.N8N_BASE_URL}`);
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

async function buildServiceWorker() {
  step("Building web push service worker");
  const result = run("bun", ["run", "build:sw"], { stdio: "inherit" });

  if (result.status !== 0) {
    fail("Failed to build service worker (bun run build:sw)");
  }
}

async function main() {
  try {
    if (devOptions.errors.length > 0) {
      fail(devOptions.errors.join("\n"));
    }
    if (remoteDb) {
      assertRemoteDbEnv();
    } else {
      await runPreflight();
    }
    await buildServiceWorker();
    startNextDev();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

void main();
