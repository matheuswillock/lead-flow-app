/**
 * Planejamento puro do fluxo de testes em container (docker-compose.test.yml).
 *
 * Duas metades, sem efeito colateral aqui — quem executa são os entrypoints
 * `scripts/test-compose.ts` (host) e `scripts/test-compose-entry.ts` (container):
 *
 *   host      Suite -> argumentos do `podman compose`.
 *   container Stage -> lista de comandos, com o mesmo ambiente do `e2e:ci`.
 */

import { basename } from "node:path";
import { buildE2eEnv, parseEnvFile, type EnvMap } from "../ci-e2e";

export const COMPOSE_FILE = "docker-compose.test.yml";

/**
 * Nome do projeto isolado por worktree. O `name: leadflow-test` fixo no YAML
 * faz duas worktrees (sessões Claude em paralelo) caírem no mesmo projeto —
 * mesmos container_name e mesmos volumes nomeados (.next, node_modules).
 * Um `next build` de uma worktree escrevendo no `.next` compartilhado
 * enquanto outra lê/escreve o mesmo volume corrompe o manifest de rotas ao
 * acaso ("client reference manifest does not exist" em rotas não relacionadas
 * à mudança sendo testada). `-p` sobrepõe o `name:` do YAML.
 */
export function projectNameFor(cwd: string): string {
  const slug = basename(cwd).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return `leadflow-test-${slug || "default"}`;
}

export const COMPOSE_PROJECT = projectNameFor(process.cwd());

export const SUITES = ["unit", "integration", "e2e", "all"] as const;
export type Suite = (typeof SUITES)[number];

export const STAGES = ["setup", "app", "unit", "integration", "e2e", "all"] as const;
export type Stage = (typeof STAGES)[number];

export interface Command {
  label: string;
  command: string;
  args: string[];
}

export function isSuite(value: string | undefined): value is Suite {
  return SUITES.includes(value as Suite);
}

export function isStage(value: string | undefined): value is Stage {
  return STAGES.includes(value as Stage);
}

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------

function compose(args: string[]): string[] {
  return ["compose", "-p", COMPOSE_PROJECT, "-f", COMPOSE_FILE, ...args];
}

/** `build` da imagem do runner — barato quando já está em cache. */
export function buildImageArgs(): string[] {
  return compose(["build", "setup"]);
}

/** Executa a suíte no serviço `tests`; as dependências (db/setup/app) sobem sozinhas. */
export function runSuiteArgs(suite: Suite): string[] {
  return compose(["--profile", "tests", "run", "--rm", "tests", "bun", "scripts/test-compose-entry.ts", suite]);
}

/** Derruba tudo; `volumes` também apaga node_modules/.next em cache. */
export function downArgs(options: { volumes: boolean }): string[] {
  return compose([
    "--profile",
    "tests",
    "down",
    "--remove-orphans",
    ...(options.volumes ? ["--volumes"] : []),
  ]);
}

export function logsArgs(service: string): string[] {
  return compose(["--profile", "tests", "logs", "--no-color", "--tail", "200", service]);
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

/** Mesmo ambiente do `e2e:ci`: `.env.test.example` (placeholders) + overrides de CI. */
export function buildTestEnv(baseEnv: EnvMap, envExampleText: string): EnvMap {
  const env = buildE2eEnv(baseEnv, parseEnvFile(envExampleText));
  // O banco do stack vive no namespace do `db`, e o app em 127.0.0.1:3000.
  return {
    ...env,
    E2E_REUSE_SERVER: "1",
    E2E_BASE_URL: "http://127.0.0.1:3000",
    NEXT_TELEMETRY_DISABLED: "1",
    // O `next build` estoura o heap padrão (~4 GB) — OOM medido em 10/11/2026.
    NODE_OPTIONS: env.NODE_OPTIONS ?? "--max-old-space-size=8192",
  };
}

// `--ignore-scripts`: o `postinstall` do projeto instala git hooks e, com o repo
// montado em /app, alteraria o `.git/hooks` do host. O Prisma Client é gerado
// explicitamente abaixo.
const SETUP_COMMANDS: Command[] = [
  { label: "instalar dependências", command: "bun", args: ["install", "--frozen-lockfile", "--ignore-scripts"] },
  { label: "gerar Prisma Client", command: "bunx", args: ["prisma", "generate"] },
  { label: "migrations + seed E2E", command: "bun", args: ["run", "db:seed:e2e"] },
  { label: "build da aplicação", command: "bun", args: ["run", "build"] },
];

const APP_COMMANDS: Command[] = [{ label: "next start", command: "bun", args: ["run", "start"] }];

const UNIT_COMMANDS: Command[] = [{ label: "testes unitários", command: "bun", args: ["run", "test"] }];

const INTEGRATION_COMMANDS: Command[] = [
  { label: "testes de integração", command: "bun", args: ["run", "test:integration"] },
];

const E2E_COMMANDS: Command[] = [
  {
    label: "Playwright",
    command: "bunx",
    // Sem `--bun`: o Playwright precisa rodar em Node (sob o runtime do bun os
    // specs falham com "AggregateError: errors building").
    args: ["playwright", "test", "--reporter=list,html"],
  },
];

export function commandsForStage(stage: Stage): Command[] {
  switch (stage) {
    case "setup":
      return SETUP_COMMANDS;
    case "app":
      return APP_COMMANDS;
    case "unit":
      return UNIT_COMMANDS;
    case "integration":
      return INTEGRATION_COMMANDS;
    case "e2e":
      return E2E_COMMANDS;
    case "all":
      return [...UNIT_COMMANDS, ...INTEGRATION_COMMANDS, ...E2E_COMMANDS];
  }
}

export interface StageDeps {
  run: (command: Command, env: EnvMap) => number;
  log: (message: string) => void;
}

/**
 * Executa os comandos da etapa em ordem e para no primeiro que falha. Com
 * `keepGoing` (suíte `all`) roda todos e devolve o primeiro código diferente de 0,
 * para o relatório mostrar o que passou e o que quebrou.
 */
export function runStage(
  stage: Stage,
  env: EnvMap,
  deps: StageDeps,
  options: { keepGoing?: boolean } = {},
): number {
  let exitCode = 0;
  for (const command of commandsForStage(stage)) {
    deps.log(`[test:compose] etapa: ${command.label}`);
    const status = deps.run(command, env);
    if (status === 0) continue;
    deps.log(`[test:compose] "${command.label}" falhou (exit ${status}).`);
    if (exitCode === 0) exitCode = status;
    if (!options.keepGoing) return exitCode;
  }
  return exitCode;
}
