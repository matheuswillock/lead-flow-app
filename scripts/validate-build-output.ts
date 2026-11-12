#!/usr/bin/env bun

/**
 * validate-build-output.ts
 *
 * Falha quando o `next build` "passou" mas o que ele produziu não serve.
 * Um exit code zero não prova que a saída está utilizável: em 21-22/08/2026
 * três deploys de produção consecutivos saíram de builds verdes com artefato
 * incompleto. Este é o equivalente em TypeScript da action
 * `.github/actions/validate-build-output` (modo `next`), para rodar no
 * Vercel CI logo após o build, na mesma tarefa.
 *
 * Uso: bun scripts/validate-build-output.ts
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export interface BuildOutputFs {
  exists(targetPath: string): boolean;
  isDirectory(targetPath: string): boolean;
  readText(targetPath: string): string;
}

export interface BuildOutputResult {
  ok: boolean;
  failures: string[];
  buildId: string | null;
}

export const DEFAULT_BUILD_DIR = ".next";

const nodeBuildOutputFs: BuildOutputFs = {
  exists: (targetPath) => existsSync(targetPath),
  isDirectory: (targetPath) => {
    try {
      return statSync(targetPath).isDirectory();
    } catch {
      return false;
    }
  },
  readText: (targetPath) => readFileSync(targetPath, "utf8"),
};

export function validateNextBuildOutput(
  fs: BuildOutputFs,
  buildDir: string = DEFAULT_BUILD_DIR,
): BuildOutputResult {
  if (!fs.isDirectory(buildDir)) {
    return {
      ok: false,
      failures: [`build nao produziu ${buildDir}`],
      buildId: null,
    };
  }

  const failures: string[] = [];
  const buildIdPath = path.join(buildDir, "BUILD_ID");
  let buildId: string | null = null;

  // BUILD_ID só é escrito no fim do build; sua ausência é o sinal mais
  // confiável de build interrompido que terminou com exit 0.
  if (!fs.exists(buildIdPath)) {
    failures.push(`${buildIdPath} ausente — build nao concluiu`);
  } else {
    buildId = fs.readText(buildIdPath).trim();
    if (buildId.length === 0) {
      buildId = null;
      failures.push(`${buildIdPath} vazio — build nao concluiu`);
    }
  }

  const serverDir = path.join(buildDir, "server");
  if (!fs.isDirectory(serverDir)) {
    failures.push(`${serverDir} ausente — nada de servidor foi emitido`);
  }

  const requiredServerFiles = path.join(buildDir, "required-server-files.json");
  if (!fs.exists(requiredServerFiles)) {
    failures.push(`${requiredServerFiles} ausente — build incompleto`);
  }

  return { ok: failures.length === 0, failures, buildId };
}

export function runValidateBuildOutput(
  fs: BuildOutputFs = nodeBuildOutputFs,
  log: Pick<Console, "info" | "error"> = console,
  buildDir: string = DEFAULT_BUILD_DIR,
): number {
  const result = validateNextBuildOutput(fs, buildDir);

  if (!result.ok) {
    for (const failure of result.failures) {
      log.error(`[build:verify] ${failure}`);
    }
    return 1;
  }

  log.info(`[build:verify] BUILD_ID: ${result.buildId}`);
  log.info("[build:verify] Build output OK (modo next).");
  return 0;
}

if (import.meta.main) {
  process.exit(runValidateBuildOutput());
}
