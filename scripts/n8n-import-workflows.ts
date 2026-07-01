#!/usr/bin/env bun
/**
 * Importa workflows Bethânia no N8N local (Docker).
 * Uso: bun run n8n:import
 * Requer: container `n8n` rodando (`bun run n8n:up`).
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dir, "..");
const WORKFLOWS_DIR = resolve(ROOT, "n8n/workflows");
const CONTAINER = "n8n";
const CONTAINER_TMP = "/tmp/lead-flow-n8n-workflows";

const WORKFLOW_FILES = [
  "bethania-push-outbound.json",
];

function run(cmd: string, args: string[]): { ok: boolean; output: string } {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, output };
}

function ensureContainerRunning(): void {
  const { ok, output } = run("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER]);
  if (!ok || output !== "true") {
    console.error(`Container ${CONTAINER} não está rodando. Execute: bun run n8n:up`);
    process.exit(1);
  }
}

function importWorkflow(filename: string): void {
  const localPath = resolve(WORKFLOWS_DIR, filename);
  const containerPath = `${CONTAINER_TMP}/${filename}`;

  readFileSync(localPath); // fail fast if missing

  run("docker", ["exec", CONTAINER, "mkdir", "-p", CONTAINER_TMP]);

  const copy = run("docker", ["cp", localPath, `${CONTAINER}:${containerPath}`]);
  if (!copy.ok) {
    console.error(`Falha ao copiar ${filename}: ${copy.output}`);
    process.exit(1);
  }

  const imported = run("docker", [
    "exec",
    CONTAINER,
    "n8n",
    "import:workflow",
    `--input=${containerPath}`,
  ]);

  if (!imported.ok) {
    console.error(`Falha ao importar ${filename}: ${imported.output}`);
    process.exit(1);
  }

  console.info(`[n8n:import] Importado: ${filename}`);
}

function publishWorkflowByName(name: string): void {
  const listed = run("docker", ["exec", CONTAINER, "n8n", "list:workflow"]);
  if (!listed.ok) {
    console.warn(`[n8n:import] Não foi possível listar workflows: ${listed.output}`);
    return;
  }

  const line = listed.output.split("\n").find((row) => row.includes(name));
  if (!line) {
    console.warn(`[n8n:import] Workflow "${name}" não encontrado para publish`);
    return;
  }

  const id = line.trim().split("|")[0];
  const published = run("docker", ["exec", CONTAINER, "n8n", "publish:workflow", `--id=${id}`]);
  if (published.ok) {
    console.info(`[n8n:import] Publicado workflow ${name} (${id})`);
    return;
  }

  console.warn(`[n8n:import] Falha ao publicar ${name}: ${published.output}`);
}

function publishWorkflows(): void {
  for (const file of WORKFLOW_FILES) {
    const name = file.replace(/\.json$/, "");
    publishWorkflowByName(name);
  }
}

function restartN8n(): void {
  const restarted = run("docker", ["restart", CONTAINER]);
  if (!restarted.ok) {
    console.warn(`[n8n:import] Falha ao reiniciar ${CONTAINER}: ${restarted.output}`);
    return;
  }
  console.info(`[n8n:import] Container ${CONTAINER} reiniciado — aguarde ~15s para webhooks ativos.`);
}

function main(): void {
  ensureContainerRunning();

  const available = readdirSync(WORKFLOWS_DIR);
  for (const file of WORKFLOW_FILES) {
    if (!available.includes(file)) {
      console.error(`Workflow não encontrado: ${file}`);
      process.exit(1);
    }
    importWorkflow(file);
  }

  publishWorkflows();
  restartN8n();
  console.info("[n8n:import] Concluído.");
}

main();
