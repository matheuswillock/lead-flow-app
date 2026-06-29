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
    if (OPTIONAL_EMPTY_KEYS.has(key)) continue;

    if (!value.trim()) {
      errors.push(`${key}: declarada no .env mas sem valor`);
    }
  }

  return errors;
}

type VercelEnvByTarget = Record<VercelEnvironment, Set<string>>;

function listVercelEnvNamesByTarget(): VercelEnvByTarget {
  const byTarget = Object.fromEntries(
    ALL_ENVIRONMENTS.map((environment) => [environment, new Set<string>()])
  ) as VercelEnvByTarget;

  for (const environment of ALL_ENVIRONMENTS) {
    const result = spawnSync("vercel", ["env", "ls", environment], {
      cwd: ROOT,
      encoding: "utf8",
    });

    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      throw new Error(
        `Falha ao listar variáveis da Vercel (${environment}). Rode \`vercel link\` antes.`
      );
    }

    for (const line of result.stdout.split(/\r?\n/)) {
      const match = line.match(/^\s+([A-Za-z0-9_]+)\s+/);
      if (match) byTarget[environment].add(match[1]);
    }
  }

  return byTarget;
}

type MissingEnvAssignment = { key: string; environment: VercelEnvironment };

function getMissingAssignments(
  filledLocal: Map<string, string>,
  remoteByTarget: VercelEnvByTarget
): MissingEnvAssignment[] {
  const missing: MissingEnvAssignment[] = [];

  for (const key of filledLocal.keys()) {
    for (const environment of getTargetEnvironments(key)) {
      if (!remoteByTarget[environment].has(key)) {
        missing.push({ key, environment });
      }
    }
  }

  return missing.sort((a, b) => {
    const keyCmp = a.key.localeCompare(b.key);
    if (keyCmp !== 0) return keyCmp;
    return ALL_ENVIRONMENTS.indexOf(a.environment) - ALL_ENVIRONMENTS.indexOf(b.environment);
  });
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

function reportVercelCoverage(
  localVars: Map<string, string>,
  remoteByTarget: VercelEnvByTarget
): void {
  const gaps: string[] = [];

  for (const key of [...localVars.keys()].sort()) {
    const missingTargets = getTargetEnvironments(key).filter(
      (environment) => !remoteByTarget[environment].has(key)
    );

    if (missingTargets.length > 0) {
      gaps.push(`${key} → ${missingTargets.join(", ")}`);
    }
  }

  if (gaps.length === 0) {
    console.info(
      "✓ Vercel: todas as chaves preenchidas do .env local estão cadastradas em todos os targets."
    );
    return;
  }

  console.info(`⚠ Vercel: ${gaps.length} chave(s) com target(s) ausente(s):`);
  for (const gap of gaps) console.info(`  - ${gap}`);
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

  const remoteByTarget = listVercelEnvNamesByTarget();
  const missingAssignments = getMissingAssignments(filledLocal, remoteByTarget);

  if (missingAssignments.length === 0) {
    console.info(
      "Nada a adicionar: todas as chaves preenchidas do .env já existem nos targets da Vercel.\n"
    );
    reportVercelCoverage(filledLocal, remoteByTarget);
    return;
  }

  const missingByKey = new Map<string, VercelEnvironment[]>();
  for (const { key, environment } of missingAssignments) {
    const targets = missingByKey.get(key) ?? [];
    targets.push(environment);
    missingByKey.set(key, targets);
  }

  console.info(`Atribuições ausentes na Vercel (${missingAssignments.length}):`);
  for (const [key, environments] of [...missingByKey.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    console.info(`  - ${key} → ${environments.join(", ")}`);
  }

  for (const { key, environment } of missingAssignments) {
    const value = filledLocal.get(key);
    if (!value) continue;

    const result = addEnvVar(key, value, environment);
    if (result === "added") {
      console.info(`✓ ${key} → ${environment}`);
    } else if (result === "exists") {
      console.info(`· ${key} → ${environment} (já existia)`);
    } else {
      console.info(`⊘ ${key} → ${environment} (pulado)`);
    }
  }

  console.info("\nConcluído. Faça redeploy na Vercel para aplicar em runtime.\n");
  reportVercelCoverage(filledLocal, listVercelEnvNamesByTarget());
}

main();
