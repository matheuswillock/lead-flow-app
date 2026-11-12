/**
 * Orquestrador HOST da suíte local 100% em container (Podman).
 *
 *   bun run test:compose              # all: unit + integration + e2e
 *   bun run test:compose:unit
 *   bun run test:compose:integration
 *   bun run test:compose:e2e
 *   bun run test:compose:down         # derruba o stack e apaga os caches
 *
 * Fluxo: build da imagem -> `podman compose run tests <suite>` (sobe db, setup
 * e app como dependências) -> down. Em falha, mostra os logs do setup/app.
 * Use KEEP_STACK=1 para manter o stack de pé e reexecutar mais rápido.
 */

import { spawnSync } from "node:child_process";
import {
  buildImageArgs,
  downArgs,
  isSuite,
  logsArgs,
  runSuiteArgs,
  SUITES,
  type Suite,
} from "./lib/test-compose";

export interface ComposeDeps {
  podman: (args: string[]) => number;
  log: (message: string) => void;
  keepStack: boolean;
}

export function runSuite(suite: Suite, deps: ComposeDeps): number {
  deps.log(`[test:compose] construindo a imagem do runner`);
  const build = deps.podman(buildImageArgs());
  if (build !== 0) return build;

  deps.log(`[test:compose] executando a suíte "${suite}" em container`);
  const status = deps.podman(runSuiteArgs(suite));

  if (status !== 0) {
    deps.log("[test:compose] falhou — últimos logs de setup e app:");
    deps.podman(logsArgs("setup"));
    deps.podman(logsArgs("app"));
  }
  if (!deps.keepStack) {
    deps.podman(downArgs({ volumes: false }));
  }
  return status;
}

export function main(argv: string[], deps: ComposeDeps): number {
  const [first] = argv;
  if (first === "down") {
    return deps.podman(downArgs({ volumes: true }));
  }
  const suite = first ?? "all";
  if (!isSuite(suite)) {
    deps.log(`[test:compose] suíte inválida: ${suite}. Use: ${SUITES.join(", ")}, down.`);
    return 2;
  }
  return runSuite(suite, deps);
}

if (import.meta.main) {
  const code = main(process.argv.slice(2), {
    podman: (args) => spawnSync("podman", args, { stdio: "inherit" }).status ?? 1,
    log: console.info,
    keepStack: process.env.KEEP_STACK === "1",
  });
  process.exit(code);
}
