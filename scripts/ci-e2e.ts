#!/usr/bin/env bun

/**
 * ci-e2e.ts
 *
 * Orquestra o E2E no Vercel CI: sobe o Postgres (supabase/postgres) em Docker,
 * roda seed, testes de integração, build e Playwright, e sempre derruba o
 * container no fim. É o equivalente em TypeScript da action
 * `.github/actions/run-e2e-playwright`, pensado para uma tarefa isolada do
 * Turborepo (sem `psql` nem sudo garantidos, sem upload de artefato).
 *
 * Uso: bun scripts/ci-e2e.ts   (via `bun run e2e:ci`)
 *
 * Este E2E espelha o do GitHub Actions; o do GitHub continua sendo o gate.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { LOCAL_DB_URL } from "./lib/local-stack";

export const POSTGRES_IMAGE = "ghcr.io/supabase/postgres:17.6.1.149";
export const POSTGRES_FALLBACK_IMAGE = "docker.io/supabase/postgres:17.6.1.149";
export const POSTGRES_HOST_PORT = 55322;
export const ENV_EXAMPLE_PATH = ".env.test.example";

export type EnvMap = Record<string, string | undefined>;
export type Privilege = "root" | "sudo" | "none";

export interface CommandRunner {
  /** Executa o comando com stdio herdado e devolve o exit code. */
  run(command: string, args: string[], env?: EnvMap): number;
}

export interface E2eLogger {
  info(message: string): void;
  error(message: string): void;
}

export interface E2eDeps {
  runner: CommandRunner;
  sleep: (ms: number) => Promise<void>;
  log: E2eLogger;
  baseEnv: EnvMap;
  envExampleText: string;
  cwd: string;
  privilege: Privilege;
  containerName: string;
}

const LOG_PREFIX = "[e2e:ci]";

/** Mesma regra do `grep -v '^#' | grep -v '^$'` da action: KEY=VALUE literal. */
export function parseEnvFile(text: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.length === 0 || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    entries[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return entries;
}

export function buildE2eEnv(
  baseEnv: EnvMap,
  envExample: Record<string, string>,
): EnvMap {
  const overrides: Record<string, string> = {
    CI: "true",
    APP_ENV: "test",
    E2E_TEST_MODE: "true",
    E2E_INCLUDE_SLOW: "false",
    // O servidor E2E inicia com NODE_ENV=production; sem uma chave explícita a
    // cifra de segredos de webhook não usa o fallback de desenvolvimento.
    STUDIO_WEBHOOK_TOKEN_SECRET: "e2e-studio-webhook-token-secret",
    ASAAS_ENV: "sandbox",
    ASAAS_URL: "https://sandbox.asaas.com",
    ASAAS_URL_sandbox: "https://sandbox.asaas.com",
    DATABASE_URL: LOCAL_DB_URL,
    DIRECT_URL: LOCAL_DB_URL,
  };

  // Sandbox real (variável de CI, nunca produção) substitui o placeholder.
  const sandboxKey = baseEnv.ASAAS_SANDBOX_API_KEY;
  if (sandboxKey) {
    overrides.ASAAS_API_KEY = sandboxKey;
    overrides.ASAAS_SANDBOX_API_KEY = sandboxKey;
  }

  return { ...baseEnv, ...envExample, ...overrides };
}

export async function pullPostgresImage(
  runner: CommandRunner,
  sleep: (ms: number) => Promise<void>,
  log: E2eLogger,
  maxAttempts = 6,
  initialDelayMs = 10_000,
): Promise<boolean> {
  let delayMs = initialDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (runner.run("docker", ["pull", POSTGRES_IMAGE]) === 0) return true;

    log.info(
      `${LOG_PREFIX} pull de ${POSTGRES_IMAGE} falhou (tentativa ${attempt}/${maxAttempts}); tentando ${POSTGRES_FALLBACK_IMAGE}.`,
    );
    // O ghcr.io já respondeu `toomanyrequests` por mais de uma hora; a mesma
    // tag existe no Docker Hub e é re-etiquetada para o nome usado no run.
    if (
      runner.run("docker", ["pull", POSTGRES_FALLBACK_IMAGE]) === 0 &&
      runner.run("docker", ["tag", POSTGRES_FALLBACK_IMAGE, POSTGRES_IMAGE]) ===
        0
    ) {
      return true;
    }

    if (attempt < maxAttempts) {
      await sleep(delayMs);
      delayMs *= 2;
    }
  }
  return false;
}

export async function startPostgres(
  runner: CommandRunner,
  sleep: (ms: number) => Promise<void>,
  log: E2eLogger,
  containerName: string,
  cwd: string,
  maxAttempts = 3,
): Promise<boolean> {
  const initDir = `${cwd}/docker/local`;
  const runArgs = [
    "run",
    "-d",
    "--name",
    containerName,
    "-e",
    "POSTGRES_PASSWORD=postgres",
    "-e",
    "POSTGRES_DB=postgres",
    "-p",
    `${POSTGRES_HOST_PORT}:5432`,
    "-v",
    `${initDir}/zz-init-auth-stub-schema.sql:/docker-entrypoint-initdb.d/zz-init-auth-stub-schema.sql:ro`,
    "-v",
    `${initDir}/zz-init-storage-stub-schema.sql:/docker-entrypoint-initdb.d/zz-init-storage-stub-schema.sql:ro`,
    POSTGRES_IMAGE,
    "postgres",
    "-c",
    "listen_addresses=*",
    "-c",
    "wal_level=logical",
    "-c",
    "max_connections=50",
  ];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (runner.run("docker", runArgs) === 0) return true;
    if (attempt < maxAttempts) {
      log.info(
        `${LOG_PREFIX} start do Postgres falhou (tentativa ${attempt}/${maxAttempts}); removendo o container e repetindo.`,
      );
      runner.run("docker", ["rm", "-f", containerName]);
      await sleep(5_000);
    }
  }
  return false;
}

/**
 * A checagem é por TCP dentro do container: durante o init da imagem o servidor
 * temporário só escuta em socket unix, então um `pg_isready` por socket
 * responderia "pronto" antes dos scripts de init terminarem.
 */
export async function waitForPostgres(
  runner: CommandRunner,
  sleep: (ms: number) => Promise<void>,
  containerName: string,
  maxAttempts = 60,
  intervalMs = 2_000,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const status = runner.run("docker", [
      "exec",
      containerName,
      "pg_isready",
      "-h",
      "127.0.0.1",
      "-p",
      "5432",
      "-U",
      "postgres",
    ]);
    if (status === 0) return true;
    await sleep(intervalMs);
  }
  return false;
}

interface Stage {
  name: string;
  run: () => Promise<number> | number;
}

function playwrightInstallArgs(privilege: Privilege): string[] {
  // `--with-deps` roda apt-get e só funciona com root ou sudo sem senha.
  return privilege === "none"
    ? ["--bun", "playwright", "install", "chromium"]
    : ["--bun", "playwright", "install", "--with-deps", "chromium"];
}

export async function runE2eCi(deps: E2eDeps): Promise<number> {
  const { runner, sleep, log, containerName, cwd, privilege } = deps;
  const env = buildE2eEnv(deps.baseEnv, parseEnvFile(deps.envExampleText));

  const stages: Stage[] = [
    {
      name: "reservar porta 55322",
      run: () => {
        // Melhor esforço: 55322 está na faixa efêmera do Linux e pode ser
        // tomada como porta de origem por uma conexão de saída.
        const args = ["sysctl", "-w", "net.ipv4.ip_local_reserved_ports=55322"];
        if (privilege === "root") runner.run(args[0], args.slice(1));
        else if (privilege === "sudo") runner.run("sudo", ["-n", ...args]);
        return 0;
      },
    },
    {
      name: "baixar imagem do Postgres",
      run: async () =>
        (await pullPostgresImage(runner, sleep, log)) ? 0 : 1,
    },
    {
      name: "subir Postgres",
      run: async () =>
        (await startPostgres(runner, sleep, log, containerName, cwd)) ? 0 : 1,
    },
    {
      name: "aguardar Postgres",
      run: async () =>
        (await waitForPostgres(runner, sleep, containerName)) ? 0 : 1,
    },
    {
      name: "seed E2E",
      run: () => runner.run("bun", ["run", "db:seed:e2e"], env),
    },
    {
      // Antes do build de propósito: roda em segundos e o `next build` leva
      // minutos; falhar aqui economiza o build.
      name: "testes de integração",
      run: () => runner.run("bun", ["run", "test:integration"], env),
    },
    {
      name: "build da aplicação",
      run: () => runner.run("bun", ["run", "build"], env),
    },
    {
      name: "instalar Chromium",
      run: () => runner.run("bunx", playwrightInstallArgs(privilege), env),
    },
    {
      // Sem artefato no Vercel CI: o reporter `list` deixa a falha nos logs.
      name: "Playwright",
      run: () =>
        runner.run(
          "bunx",
          ["--bun", "playwright", "test", "--reporter=list,html"],
          env,
        ),
    },
  ];

  let exitCode = 0;
  try {
    for (const stage of stages) {
      log.info(`${LOG_PREFIX} etapa: ${stage.name}`);
      const status = await stage.run();
      if (status !== 0) {
        log.error(
          `${LOG_PREFIX} etapa "${stage.name}" falhou (exit ${status}).`,
        );
        exitCode = status;
        break;
      }
    }
  } finally {
    runner.run("docker", ["rm", "-f", containerName]);
  }

  if (exitCode === 0) log.info(`${LOG_PREFIX} E2E concluído com sucesso.`);
  return exitCode;
}

function createNodeRunner(): CommandRunner {
  return {
    run: (command, args, env) =>
      spawnSync(command, args, {
        stdio: "inherit",
        shell: false,
        env: env
          ? (Object.fromEntries(
              Object.entries(env).filter(([, value]) => value !== undefined),
            ) as NodeJS.ProcessEnv)
          : process.env,
      }).status ?? 1,
  };
}

export function detectPrivilege(runner: CommandRunner): Privilege {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    return "root";
  }
  return runner.run("sudo", ["-n", "true"]) === 0 ? "sudo" : "none";
}

export function createDefaultDeps(): E2eDeps {
  const runner = createNodeRunner();
  return {
    runner,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log: { info: console.info, error: console.error },
    baseEnv: process.env,
    envExampleText: readFileSync(ENV_EXAMPLE_PATH, "utf8"),
    cwd: process.cwd(),
    privilege: detectPrivilege(runner),
    containerName: `e2e-postgres-ci-${process.pid}`,
  };
}

if (import.meta.main) {
  runE2eCi(createDefaultDeps()).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(`${LOG_PREFIX} erro fatal:`, error);
      process.exit(1);
    },
  );
}
