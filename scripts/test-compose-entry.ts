/**
 * Entrypoint DENTRO do container (docker-compose.test.yml).
 *
 *   bun scripts/test-compose-entry.ts <setup|app|unit|integration|e2e|all>
 *
 * Aplica o ambiente de CI (.env.test.example + overrides do `e2e:ci`) e executa
 * a etapa. Não é chamado no host — use `bun run test:compose`.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildTestEnv,
  isStage,
  runStage,
  type Command,
  type Stage,
} from "./lib/test-compose";
import type { EnvMap } from "./ci-e2e";

function spawnCommand(command: Command, env: EnvMap): number {
  const result = spawnSync(command.command, command.args, {
    stdio: "inherit",
    shell: false,
    env: env as NodeJS.ProcessEnv,
  });
  return result.status ?? 1;
}

export function main(argv: string[]): number {
  const stage = argv[0];
  if (!isStage(stage)) {
    console.error(`[test:compose] etapa inválida: ${stage ?? "(vazia)"}`);
    return 2;
  }
  const envExampleText = readFileSync(join(process.cwd(), ".env.test.example"), "utf8");
  const env = buildTestEnv(process.env as EnvMap, envExampleText);
  return runStage(stage as Stage, env, { run: spawnCommand, log: console.info }, { keepGoing: stage === "all" });
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
