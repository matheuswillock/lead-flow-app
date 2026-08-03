/**
 * Stack local híbrido (docker-compose.local.yml): Postgres + Realtime locais,
 * Auth + Storage no Supabase remoto.
 *
 * Substitui o `supabase start` no dia a dia — bem mais leve em RAM/CPU porque
 * não sobe GoTrue, Kong completo, PostgREST, Storage API, Studio ou Inbucket.
 *
 * Este módulo centraliza:
 *   - URLs/porta do Postgres e do proxy local
 *   - Leitura dos segredos do projeto remoto em docker/local/.env.local-stack
 *   - probe/start/stop do stack via `docker compose`
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
export const LOCAL_PROXY_URL = "http://127.0.0.1:55321";

const COMPOSE_FILE = join(process.cwd(), "docker-compose.local.yml");
const STACK_ENV_FILE = join(process.cwd(), "docker", "local", ".env.local-stack");
const STACK_ENV_EXAMPLE = join(process.cwd(), "docker", "local", ".env.local-stack.example");

type EnvOverrides = Partial<NodeJS.ProcessEnv>;

type RunResult = { status: number; stdout: string; stderr: string };

function run(
  cmd: string,
  args: string[],
  opts: { stdio?: "inherit" | "pipe"; env?: EnvOverrides } = {},
): RunResult {
  const result = spawnSync(cmd, args, {
    stdio: opts.stdio ?? "pipe",
    shell: false,
    encoding: "utf8",
    env: { ...process.env, ...opts.env },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function readEnvFileValue(filePath: string, key: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  const content = readFileSync(filePath, "utf8");
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

export function localStackEnvFileExists(): boolean {
  return existsSync(STACK_ENV_FILE);
}

export type RemoteStackOverrides = {
  SUPABASE_REMOTE_HOST?: string;
  SUPABASE_REMOTE_ANON_KEY?: string;
  SUPABASE_REMOTE_SERVICE_ROLE_KEY?: string;
  SUPABASE_REMOTE_JWT_SECRET?: string;
};

/** Lê os segredos do projeto remoto de docker/local/.env.local-stack. */
export function readRemoteStackOverrides(): RemoteStackOverrides {
  return {
    SUPABASE_REMOTE_HOST: readEnvFileValue(STACK_ENV_FILE, "SUPABASE_REMOTE_HOST"),
    SUPABASE_REMOTE_ANON_KEY: readEnvFileValue(STACK_ENV_FILE, "SUPABASE_REMOTE_ANON_KEY"),
    SUPABASE_REMOTE_SERVICE_ROLE_KEY: readEnvFileValue(STACK_ENV_FILE, "SUPABASE_REMOTE_SERVICE_ROLE_KEY"),
    SUPABASE_REMOTE_JWT_SECRET: readEnvFileValue(STACK_ENV_FILE, "SUPABASE_REMOTE_JWT_SECRET"),
  };
}

function composeArgs(args: string[]): string[] {
  const base = ["compose", "-f", COMPOSE_FILE];
  if (existsSync(STACK_ENV_FILE)) {
    base.push("--env-file", STACK_ENV_FILE);
  }
  return [...base, ...args];
}

export function runLocalStackCompose(
  args: string[],
  opts: { stdio?: "inherit" | "pipe" } = {},
): RunResult {
  return run("docker", composeArgs(args), opts);
}

/** Verifica se o Postgres local está aceitando conexões. */
export function probeLocalPostgres(): boolean {
  const result = run("psql", [LOCAL_DB_URL, "-t", "-A", "-c", "SELECT 1"], {
    env: { PGCONNECT_TIMEOUT: "2" },
  });
  return result.status === 0;
}

/** Verifica se o proxy local está de pé (rota /auth/v1/health, pública no Supabase). */
export function probeLocalProxy(): boolean {
  const result = run("curl", ["-sf", "-o", "/dev/null", `${LOCAL_PROXY_URL}/auth/v1/health`], {
    stdio: "pipe",
  });
  return result.status === 0;
}

/** true quando Postgres local + proxy (Auth remoto via proxy) respondem. */
export function probeLocalStack(): boolean {
  return probeLocalPostgres() && probeLocalProxy();
}

export function assertLocalStackConfigured(): void {
  if (localStackEnvFileExists()) return;
  console.error(
    `\n❌ ${STACK_ENV_FILE} não encontrado.\n` +
      `   Copie ${STACK_ENV_EXAMPLE} para ${STACK_ENV_FILE} e preencha os` +
      " segredos do projeto Supabase remoto (Settings → API).",
  );
  process.exit(1);
}

export function startLocalStack(): RunResult {
  assertLocalStackConfigured();
  return runLocalStackCompose(["up", "-d"], { stdio: "inherit" });
}

export function stopLocalStack(): RunResult {
  return runLocalStackCompose(["down"], { stdio: "inherit" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Aguarda Postgres + proxy responderem, até maxWaitMs. */
export async function waitForLocalStack(maxWaitMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (probeLocalStack()) return true;
    await sleep(1_500);
  }
  return false;
}
