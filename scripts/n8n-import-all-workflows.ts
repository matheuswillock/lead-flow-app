#!/usr/bin/env bun
/**
 * Importa todos os workflows Bethânia no N8N (dev local ou VPS).
 * Uso: bun run n8n:import:all
 * Requer: container `n8n` rodando (`bun run n8n:up` ou `bun run vps:up`).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dir, "..");
const WORKFLOWS_DIR = resolve(ROOT, "n8n/workflows");
const CONTAINER = "n8n";
const CONTAINER_TMP = "/tmp/lead-flow-n8n-workflows";

/** Ordem sugerida em n8n/README.md — error notifier primeiro; router por último na ativação */
const WORKFLOW_FILES = [
  "bethania-error-notifier.json",
  "bethania-verification-channel.json",
  "bethania-verification-web.json",
  "bethania-menu-main.json",
  "bethania-list-leads.json",
  "bethania-agenda-today.json",
  "bethania-list-tasks.json",
  "bethania-add-note-confirm.json",
  "bethania-push-outbound.json",
  "bethania-router.json",
];

function run(cmd: string, args: string[]): { ok: boolean; output: string } {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0, output };
}

function ensureContainerRunning(): void {
  const { ok, output } = run("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER]);
  if (ok && output === "true") {
    return;
  }

  // Fallback: podman/docker CLI às vezes falha no inspect; healthz do N8N basta.
  try {
    const health = spawnSync("curl", ["-sf", "http://127.0.0.1:5678/healthz"], {
      encoding: "utf8",
    });
    if (health.status === 0) {
      console.warn(
        `[n8n:import:all] docker inspect falhou (${output || "sem saída"}); seguindo via healthz.`
      );
      return;
    }
  } catch {
    // ignore
  }

  console.error(`Container ${CONTAINER} não está rodando. Execute: bun run n8n:up ou bun run vps:up`);
  process.exit(1);
}

function importWorkflow(filename: string): void {
  const localPath = resolve(WORKFLOWS_DIR, filename);
  const containerPath = `${CONTAINER_TMP}/${filename}`;

  readFileSync(localPath);

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

  console.info(`[n8n:import:all] Importado: ${filename}`);
}

function publishWorkflowByName(name: string): void {
  const listed = run("docker", ["exec", CONTAINER, "n8n", "list:workflow"]);
  if (!listed.ok) {
    console.warn(`[n8n:import:all] Não foi possível listar workflows: ${listed.output}`);
    return;
  }

  const line = listed.output.split("\n").find((row) => row.includes(name));
  if (!line) {
    console.warn(`[n8n:import:all] Workflow "${name}" não encontrado para publish`);
    return;
  }

  const id = line.trim().split("|")[0];
  const published = run("docker", ["exec", CONTAINER, "n8n", "publish:workflow", `--id=${id}`]);
  if (published.ok) {
    console.info(`[n8n:import:all] Publicado: ${name} (${id})`);
    return;
  }

  console.warn(`[n8n:import:all] Falha ao publicar ${name}: ${published.output}`);
}

/** n8n 2.x: publish sozinho não registra webhook de produção até active + restart. */
function activateWorkflowByName(name: string): void {
  const listed = run("docker", ["exec", CONTAINER, "n8n", "list:workflow"]);
  if (!listed.ok) {
    console.warn(`[n8n:import:all] Não foi possível listar workflows: ${listed.output}`);
    return;
  }

  const line = listed.output.split("\n").find((row) => row.includes(name));
  if (!line) {
    console.warn(`[n8n:import:all] Workflow "${name}" não encontrado para activate`);
    return;
  }

  const id = line.trim().split("|")[0];
  const activated = run("docker", [
    "exec",
    CONTAINER,
    "n8n",
    "update:workflow",
    `--id=${id}`,
    "--active=true",
  ]);
  if (activated.ok) {
    console.info(`[n8n:import:all] Ativado (DB): ${name} (${id})`);
    return;
  }

  console.warn(`[n8n:import:all] Falha ao ativar ${name}: ${activated.output}`);
}

function restartN8nForWebhooks(): void {
  console.info("[n8n:import:all] Reiniciando container n8n para registrar webhooks de produção...");
  const restarted = run("docker", ["restart", CONTAINER]);
  if (!restarted.ok) {
    console.warn(`[n8n:import:all] Falha ao reiniciar n8n: ${restarted.output}`);
    console.warn("[n8n:import:all] Ative bethania-router na UI e reinicie o container manualmente.");
    return;
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const health = spawnSync("curl", ["-sf", "http://127.0.0.1:5678/healthz"], {
      encoding: "utf8",
    });
    if (health.status === 0) {
      console.info("[n8n:import:all] N8N healthy após restart.");
      return;
    }
    spawnSync("sleep", ["2"]);
  }

  console.warn("[n8n:import:all] N8N ainda não respondeu healthz após restart.");
}

function main(): void {
  ensureContainerRunning();

  for (const file of WORKFLOW_FILES) {
    importWorkflow(file);
  }

  for (const file of WORKFLOW_FILES) {
    publishWorkflowByName(file.replace(/\.json$/, ""));
  }

  // Error notifier + webhooks de produção precisam estar active no DB + processo n8n reiniciado.
  for (const name of ["bethania-error-notifier", "bethania-push-outbound", "bethania-router"]) {
    activateWorkflowByName(name);
  }
  restartN8nForWebhooks();

  console.info(
    "[n8n:import:all] Concluído. Próximo: Salvar URL inbound no Canal → Reconectar Evolution."
  );
}

main();
