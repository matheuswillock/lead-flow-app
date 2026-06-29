#!/usr/bin/env bun
/**
 * Valida o .env local e adiciona na Vercel apenas variáveis preenchidas que ainda não existem.
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
const ENV_EXAMPLE = resolve(ROOT, ".env.example");
const ALL_ENVIRONMENTS = ["production", "preview", "development"] as const;
type VercelEnvironment = (typeof ALL_ENVIRONMENTS)[number];

/** Pode estar ausente ou vazia no .env (dev local / integrações opcionais). */
const OPTIONAL_EMPTY_KEYS = new Set([
  "NEXT_PUBLIC_API_URL",
  "META_APP_SECRET",
  "META_ACCESS_TOKEN",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "EVO_API_BASE_URL",
  "EVO_WEBHOOK_PUBLIC_URL",
]);

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

function extractKeysFromEnvContent(content: string): string[] {
  const keys: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    keys.push(line.slice(0, eq).trim());
  }

  return keys;
}

function normalizeEnvValue(rawValue: string): string {
  let value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  const hashIdx = value.indexOf(" #");
  if (hashIdx >= 0) value = value.slice(0, hashIdx).trim();

  return value;
}

function parseEnvEntries(content: string): Map<string, string> {
  const vars = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    const value = normalizeEnvValue(line.slice(eq + 1));

    if (key) vars.set(key, value);
  }

  return vars;
}

function validateLocalEnv(
  localVars: Map<string, string>,
  requiredKeys: string[]
): string[] {
  const errors: string[] = [];

  for (const key of requiredKeys) {
    if (OPTIONAL_EMPTY_KEYS.has(key)) continue;

    const value = localVars.get(key);
    if (value === undefined) {
      errors.push(`${key}: ausente no .env`);
      continue;
    }

    if (!value.trim()) {
      errors.push(`${key}: vazio no .env`);
    }
  }

  for (const [key, value] of localVars) {
    if (!value.trim()) {
      errors.push(`${key}: declarada no .env mas sem valor`);
    }
  }

  return errors;
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

function reportVercelCoverage(localVars: Map<string, string>, remoteNames: Set<string>): void {
  const missingOnVercel = [...localVars.keys()]
    .filter((key) => !remoteNames.has(key))
    .sort();

  if (missingOnVercel.length === 0) {
    console.info("✓ Vercel: todas as chaves preenchidas do .env local estão cadastradas.");
    return;
  }

  console.info(`⚠ Vercel: ${missingOnVercel.length} chave(s) do .env local ainda ausente(s):`);
  for (const key of missingOnVercel) console.info(`  - ${key}`);
}

function main() {
  const requiredKeys = extractKeysFromEnvContent(readFileSync(ENV_EXAMPLE, "utf8"));
  const localVars = parseEnvEntries(readFileSync(ENV_FILE, "utf8"));

  const localErrors = validateLocalEnv(localVars, requiredKeys);
  if (localErrors.length > 0) {
    console.error("❌ Validação do .env local falhou:\n");
    for (const error of localErrors) console.error(`  - ${error}`);
    console.error("\nPreencha todas as variáveis obrigatórias antes de sincronizar com a Vercel.");
    console.error("Consulte .env.example para a lista completa.\n");
    process.exit(1);
  }

  const filledLocal = new Map(
    [...localVars.entries()].filter(([, value]) => value.trim().length > 0)
  );

  console.info(`✓ .env local validado (${filledLocal.size} variáveis preenchidas)\n`);

  const remoteNames = listVercelEnvNames();
  const missing = [...filledLocal.keys()].filter((key) => !remoteNames.has(key)).sort();

  if (missing.length === 0) {
    console.info("Nada a adicionar: todas as chaves preenchidas do .env já existem na Vercel.\n");
    reportVercelCoverage(filledLocal, remoteNames);
    return;
  }

  console.info(`Chaves ausentes na Vercel (${missing.length}):`);
  for (const key of missing) console.info(`  - ${key}`);

  for (const key of missing) {
    const value = filledLocal.get(key);
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

  console.info("\nConcluído. Faça redeploy na Vercel para aplicar em runtime.\n");
  reportVercelCoverage(filledLocal, listVercelEnvNames());
}

main();
