#!/usr/bin/env bun
/**
 * Adiciona na Vercel apenas variáveis presentes no .env local que ainda não existem.
 * Não sobrescreve variáveis já configuradas.
 *
 * Uso: bun run scripts/sync-vercel-env-missing.ts
 * Requer: projeto linkado (`vercel link --project corretor-studio --yes`)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dir, "..");
const ENV_FILE = resolve(ROOT, ".env");
const ALL_ENVIRONMENTS = ["production", "preview", "development"] as const;
type VercelEnvironment = (typeof ALL_ENVIRONMENTS)[number];

const SENSITIVE_KEYS = new Set([
  "WEB_PUSH_VAPID_PRIVATE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "POSTGRES_PASSWORD",
  "DATABASE_URL",
  "DIRECT_URL",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
  "ENCRYPTION_KEY",
  "INTEGRATIONS_ENCRYPTION_KEY",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "SENTRY_AUTH_TOKEN",
  "CRON_SECRET",
]);

function parseEnvFile(content: string): Map<string, string> {
  const vars = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    const hashIdx = value.indexOf(" #");
    if (hashIdx >= 0) value = value.slice(0, hashIdx).trim();

    if (key && value) vars.set(key, value);
  }

  return vars;
}

function listVercelEnvNames(): Set<string> {
  const result = spawnSync("vercel", ["env", "ls"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error("Falha ao listar variáveis da Vercel. Rode `vercel link` antes.");
  }

  const names = new Set<string>();
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^\s+([A-Za-z0-9_]+)\s+/);
    if (match) names.add(match[1]);
  }

  return names;
}

/** Vercel não permite variáveis sensíveis no ambiente development. */
function getTargetEnvironments(key: string): VercelEnvironment[] {
  if (SENSITIVE_KEYS.has(key)) return ["production", "preview"];
  return [...ALL_ENVIRONMENTS];
}

type AddEnvResult = "added" | "exists" | "skipped";

function addEnvVar(key: string, value: string, environment: VercelEnvironment): AddEnvResult {
  const args = ["env", "add", key, environment];
  if (SENSITIVE_KEYS.has(key)) args.push("--sensitive");

  const result = spawnSync("vercel", args, {
    cwd: ROOT,
    input: value,
    encoding: "utf8",
  });

  if (result.status === 0) return "added";

  const output = `${result.stdout}\n${result.stderr}`.toLowerCase();
  if (
    output.includes("already exists") ||
    output.includes("env variable already exists") ||
    output.includes("has already been added")
  ) {
    return "exists";
  }

  if (output.includes("cannot set a sensitive environment variable's target to development")) {
    return "skipped";
  }

  console.error(result.stderr || result.stdout);
  throw new Error(`Falha ao adicionar ${key} (${environment})`);
}

function main() {
  const localVars = parseEnvFile(readFileSync(ENV_FILE, "utf8"));
  const remoteNames = listVercelEnvNames();

  const missing = [...localVars.keys()].filter((key) => !remoteNames.has(key)).sort();

  if (missing.length === 0) {
    console.info("Nada a fazer: todas as chaves do .env já existem na Vercel.");
    return;
  }

  console.info(`Chaves ausentes na Vercel (${missing.length}):`);
  for (const key of missing) console.info(`  - ${key}`);

  for (const key of missing) {
    const value = localVars.get(key);
    if (!value) continue;

    for (const environment of getTargetEnvironments(key)) {
      const result = addEnvVar(key, value, environment);
      if (result === "added") {
        console.info(`✓ ${key} → ${environment}`);
      } else if (result === "exists") {
        console.info(`· ${key} → ${environment} (já existia)`);
      } else {
        console.info(`⊘ ${key} → ${environment} (pulado)`);
      }
    }
  }

  console.info("\nConcluído. Faça redeploy na Vercel para aplicar em runtime.");
}

main();
