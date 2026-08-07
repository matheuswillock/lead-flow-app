#!/usr/bin/env bun
/**
 * Wrapper para docker compose da stack VPS — exporta .env.n8n para interpolação
 * de N8N_POSTGRES_PASSWORD no compose.
 * Uso: bun scripts/vps-compose.ts up -d
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dir, "..");
const N8N_ENV = resolve(ROOT, ".env.n8n");
const OPENWA_ENV = resolve(ROOT, ".env.openwa");
const COMPOSE_FILE = resolve(ROOT, "docker-compose.vps.yml");

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Uso: bun scripts/vps-compose.ts <docker compose args>");
    process.exit(1);
  }

  if (!existsSync(OPENWA_ENV)) {
    console.error(`Arquivo ausente: ${OPENWA_ENV}`);
    process.exit(1);
  }
  if (!existsSync(N8N_ENV)) {
    console.error(`Arquivo ausente: ${N8N_ENV}`);
    process.exit(1);
  }

  loadEnvFile(N8N_ENV);
  loadEnvFile(OPENWA_ENV);

  const result = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      COMPOSE_FILE,
      "--env-file",
      N8N_ENV,
      "--env-file",
      OPENWA_ENV,
      ...args,
    ],
    { stdio: "inherit", env: process.env, shell: false },
  );

  process.exit(result.status ?? 1);
}

main();
