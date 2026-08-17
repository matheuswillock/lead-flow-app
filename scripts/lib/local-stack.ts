/**
 * Stack local (docker-compose.local.yml).
 *
 * Três modos:
 *   db-only  — só Postgres :55322 (padrão de `bun run dev`). Auth/Storage
 *              continuam no `.env` remoto. Sem Elixir, sem Caddy, sem
 *              `.env.local-stack`.
 *   hybrid   — Postgres + Realtime + Caddy :55321. Exige
 *              docker/local/.env.local-stack. `bun run dev -- --hybrid`.
 *   full     — `supabase start` (não usa este compose). `--full-supabase`.
 *
 * Este módulo centraliza URLs/porta, leitura dos segredos híbridos e
 * probe/start/stop via `docker compose`.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type LocalStackMode = "db-only" | "hybrid";

export const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
/** Superuser da imagem supabase/postgres — necessário para ALTER em `auth.*`. */
export const LOCAL_DB_ADMIN_URL = "postgresql://supabase_admin:postgres@127.0.0.1:55322/postgres";
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
  SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN?: string;
};

/** Lê os segredos do projeto remoto de docker/local/.env.local-stack (modo hybrid). */
export function readRemoteStackOverrides(): RemoteStackOverrides {
  return {
    SUPABASE_REMOTE_HOST: readEnvFileValue(STACK_ENV_FILE, "SUPABASE_REMOTE_HOST"),
    SUPABASE_REMOTE_ANON_KEY: readEnvFileValue(STACK_ENV_FILE, "SUPABASE_REMOTE_ANON_KEY"),
    SUPABASE_REMOTE_SERVICE_ROLE_KEY: readEnvFileValue(STACK_ENV_FILE, "SUPABASE_REMOTE_SERVICE_ROLE_KEY"),
    SUPABASE_REMOTE_JWT_SECRET: readEnvFileValue(STACK_ENV_FILE, "SUPABASE_REMOTE_JWT_SECRET"),
    // Opt-in explícito: sem isso, createSupabaseAdmin() (lib/supabase/server.ts)
    // recusa criar o client quando o stack local aponta Auth remoto —
    // evita que ações admin (deletar usuário, apagar arquivo) mutem o
    // projeto remoto de verdade a partir de um `bun dev` local.
    SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN: readEnvFileValue(STACK_ENV_FILE, "SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN"),
  };
}

function podmanSocketPath(): string {
  const dockerHost = process.env.DOCKER_HOST ?? "";
  if (dockerHost.startsWith("unix://")) {
    return dockerHost.slice("unix://".length);
  }
  const runtimeDir = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 1000}`;
  return join(runtimeDir, "podman", "podman.sock");
}

/**
 * No Fedora/Podman o `docker compose` fala com unix:///run/user/UID/podman/podman.sock.
 * O unit `podman.socket` às vezes fica "active" no systemd sem o arquivo do socket
 * (após idle/stop do service). Recria com `systemctl --user restart podman.socket`.
 */
function ensureContainerRuntime(): void {
  const sock = podmanSocketPath();
  if (existsSync(sock)) return;

  const restart = run("systemctl", ["--user", "restart", "podman.socket"], { stdio: "pipe" });
  if (restart.status === 0 && existsSync(sock)) {
    console.info("  ✓ Podman API socket recriado (`systemctl --user restart podman.socket`).");
    return;
  }

  console.error(
    `\n❌ Socket do container runtime não encontrado: ${sock}\n` +
      "   No Fedora/Podman: `systemctl --user restart podman.socket`\n" +
      "   Confira também se o Podman/Docker está instalado e o usuário no grupo certo.",
  );
  process.exit(1);
}

function composeArgs(mode: LocalStackMode, args: string[]): string[] {
  const base = ["compose", "-f", COMPOSE_FILE];
  if (mode === "hybrid") {
    base.push("--profile", "hybrid");
    if (existsSync(STACK_ENV_FILE)) {
      base.push("--env-file", STACK_ENV_FILE);
    }
  }
  return [...base, ...args];
}

export function runLocalStackCompose(
  args: string[],
  opts: { stdio?: "inherit" | "pipe"; mode?: LocalStackMode } = {},
): RunResult {
  const mode = opts.mode ?? "db-only";
  return run("docker", composeArgs(mode, args), opts);
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

/** true quando os serviços do modo respondem. */
export function probeLocalStack(mode: LocalStackMode = "db-only"): boolean {
  if (mode === "hybrid") {
    return probeLocalPostgres() && probeLocalProxy();
  }
  return probeLocalPostgres();
}

export function assertLocalStackConfigured(): void {
  if (localStackEnvFileExists()) return;
  console.error(
    `\n❌ ${STACK_ENV_FILE} não encontrado.\n` +
      `   O modo --hybrid precisa desse arquivo (Realtime + Caddy).\n` +
      `   Copie ${STACK_ENV_EXAMPLE} para ${STACK_ENV_FILE} e preencha os` +
      " segredos do projeto Supabase remoto (Settings → API).\n" +
      "   Se não quiser preencher `.env.local-stack`, rode `bun run dev` sem `--hybrid` (modo db-only).",
  );
  process.exit(1);
}

export function startLocalStack(mode: LocalStackMode = "db-only"): RunResult {
  ensureContainerRuntime();
  if (mode === "hybrid") {
    assertLocalStackConfigured();
    return runLocalStackCompose(["up", "-d"], { stdio: "inherit", mode });
  }
  // Nomeia `db` para o compose não tentar subir realtime/proxy se o provider
  // (Podman + docker-compose) ignorar `profiles`.
  return runLocalStackCompose(["up", "-d", "db"], { stdio: "inherit", mode });
}

export function stopLocalStack(mode: LocalStackMode = "db-only"): RunResult {
  return runLocalStackCompose(["down"], { stdio: "inherit", mode });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Aguarda os serviços do modo responderem, até maxWaitMs. */
export async function waitForLocalStack(
  mode: LocalStackMode = "db-only",
  maxWaitMs = 60_000,
): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (probeLocalStack(mode)) return true;
    await sleep(1_500);
  }
  return false;
}
