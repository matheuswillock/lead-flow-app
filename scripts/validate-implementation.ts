#!/usr/bin/env bun

/**
 * Orquestra o `validate:implementation` em fases.
 *
 * Fase 1 (serial, fail-fast, segundos): sync de governança, diff de
 * adapters e os checks leves. Qualquer falha aqui aborta antes dos
 * checks pesados.
 *
 * Fase 2 (paralela): `lint`, `typecheck` e `test` rodam juntos — são
 * independentes entre si e dominam o tempo do hook. O wall time cai
 * para o mais lento dos três em vez da soma.
 *
 * Uso:
 *   bun scripts/validate-implementation.ts
 */

import { spawn } from "node:child_process";

type Step = { name: string; cmd: string; args: string[] };
type StepResult = { name: string; exitCode: number; durationMs: number; output: string };

const FAST_STEPS: Step[] = [
  { name: "governance:sync", cmd: "bun", args: ["run", "governance:sync"] },
  {
    name: "adapters-diff",
    cmd: "git",
    args: [
      "diff",
      "--exit-code",
      "--",
      ".github/copilot-instructions.md",
      ".cursor/rules/lead-flow-agents.mdc",
      "CLAUDE.md",
    ],
  },
  { name: "governance:check", cmd: "bun", args: ["run", "governance:check"] },
  { name: "governance:check-e2e-pages", cmd: "bun", args: ["run", "governance:check-e2e-pages"] },
  { name: "governance:check-responsive", cmd: "bun", args: ["run", "governance:check-responsive"] },
  { name: "governance:check-api-masking", cmd: "bun", args: ["run", "governance:check-api-masking"] },
  { name: "lint:pt-br:strict", cmd: "bun", args: ["run", "lint:pt-br:strict"] },
];

const PARALLEL_STEPS: Step[] = [
  { name: "lint", cmd: "bun", args: ["run", "lint"] },
  { name: "typecheck", cmd: "bun", args: ["run", "typecheck"] },
  { name: "test", cmd: "bun", args: ["run", "test"] },
];

function runStep(step: Step): Promise<StepResult> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(step.cmd, step.args, { env: process.env });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      for (const line of text.split("\n")) {
        if (line.trim()) console.info(`[${step.name}] ${line}`);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      for (const line of text.split("\n")) {
        if (line.trim()) console.info(`[${step.name}] ${line}`);
      }
    });
    child.on("close", (code) => {
      resolve({ name: step.name, exitCode: code ?? 1, durationMs: Date.now() - startedAt, output });
    });
    child.on("error", (error) => {
      resolve({
        name: step.name,
        exitCode: 1,
        durationMs: Date.now() - startedAt,
        output: `${output}\nspawn error: ${String(error)}`,
      });
    });
  });
}

function report(results: StepResult[]): boolean {
  console.info("\n▶ Resumo da validação");
  let ok = true;
  for (const result of results) {
    const status = result.exitCode === 0 ? "OK " : "FALHOU";
    if (result.exitCode !== 0) ok = false;
    console.info(`  [${status}] ${result.name} (${(result.durationMs / 1000).toFixed(0)}s)`);
  }
  return ok;
}

const fastResults: StepResult[] = [];
for (const step of FAST_STEPS) {
  console.info(`\n▶ ${step.name} (fase rápida)`);
  const result = await runStep(step);
  fastResults.push(result);
  if (result.exitCode !== 0) {
    console.error(`\n❌ ${step.name} reprovou — abortando antes dos checks pesados.`);
    report(fastResults);
    process.exit(result.exitCode);
  }
}

console.info("\n▶ Fase paralela: lint + typecheck + test");
const parallelResults = await Promise.all(PARALLEL_STEPS.map(runStep));

const all = [...fastResults, ...parallelResults];
if (!report(all)) {
  const failed = parallelResults.filter((result) => result.exitCode !== 0).map((result) => result.name);
  console.error(`\n❌ Validação reprovada em: ${failed.join(", ")}`);
  process.exit(1);
}

console.info("\n✅ Validação de implementação completa.");
