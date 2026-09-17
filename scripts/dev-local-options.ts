import type { LocalStackMode } from "./lib/local-stack";

export type DevLocalOptions = {
  skipClone: boolean;
  clone: boolean;
  noStart: boolean;
  forceTurbo: boolean;
  fullSupabase: boolean;
  remoteDb: boolean;
  stackMode: LocalStackMode;
  nextArgs: string[];
  errors: string[];
};

/**
 * Stacks opcionais removidas junto com n8n/Evolution. Continuam reconhecidas só
 * para devolver um erro claro a quem tinha `bun dev -- n8n` na memória muscular.
 */
const REMOVED_STACK_ARGS = new Set([
  "n8n",
  "--n8n",
  "evolution",
  "--evolution",
  "total",
  "--total",
  "--skip-n8n",
  "--skip-evo",
]);

export function parseDevLocalArgs(rawArgs: string[]): DevLocalOptions {
  const nextArgs: string[] = [];
  const errors: string[] = [];
  const removedStackArgs: string[] = [];

  let skipClone = false;
  let clone = false;
  let noStart = false;
  let forceTurbo = false;
  let fullSupabase = false;
  let remoteDb = false;
  let hybridRequested = false;
  let dbOnlyRequested = false;

  for (const arg of rawArgs) {
    if (arg === "--") continue;

    if (arg === "--skip-clone") {
      skipClone = true;
      continue;
    }
    if (arg === "--clone") {
      clone = true;
      continue;
    }
    if (arg === "--no-start") {
      noStart = true;
      continue;
    }
    if (arg === "--full-supabase") {
      fullSupabase = true;
      continue;
    }
    if (arg === "--remote-db") {
      remoteDb = true;
      continue;
    }
    if (arg === "--hybrid") {
      hybridRequested = true;
      continue;
    }
    if (arg === "--db-only") {
      dbOnlyRequested = true;
      continue;
    }
    if (arg === "--turbo" || arg === "--turbopack") {
      forceTurbo = true;
      continue;
    }
    if (REMOVED_STACK_ARGS.has(arg.toLowerCase())) {
      removedStackArgs.push(arg);
      continue;
    }

    nextArgs.push(arg);
  }

  if (removedStackArgs.length > 0) {
    errors.push(
      `As stacks locais de N8N/Evolution foram removidas — opção não existe mais: ${removedStackArgs.join(", ")}`
    );
  }
  if (hybridRequested && dbOnlyRequested) {
    errors.push("Cannot pass --hybrid and --db-only at the same time.");
  }
  if (hybridRequested && fullSupabase) {
    errors.push("Cannot pass --hybrid and --full-supabase at the same time.");
  }
  if (clone && skipClone) {
    errors.push("Cannot pass --clone and --skip-clone at the same time.");
  }
  if (remoteDb && hybridRequested) {
    errors.push("Cannot pass --remote-db and --hybrid at the same time.");
  }
  if (remoteDb && dbOnlyRequested) {
    errors.push("Cannot pass --remote-db and --db-only at the same time.");
  }
  if (remoteDb && fullSupabase) {
    errors.push("Cannot pass --remote-db and --full-supabase at the same time.");
  }
  if (remoteDb && clone) {
    errors.push("Cannot pass --remote-db and --clone at the same time.");
  }

  const stackMode: LocalStackMode = hybridRequested ? "hybrid" : "db-only";

  return {
    skipClone,
    clone,
    noStart,
    forceTurbo,
    fullSupabase,
    remoteDb,
    stackMode,
    nextArgs,
    errors,
  };
}
