import type { LocalStackMode } from "./lib/local-stack";

export type DevLocalOptions = {
  skipClone: boolean;
  clone: boolean;
  noStart: boolean;
  forceTurbo: boolean;
  fullSupabase: boolean;
  stackMode: LocalStackMode;
  startEvolution: boolean;
  startN8n: boolean;
  nextArgs: string[];
  errors: string[];
};

const OPTIONAL_STACK_ARGS = new Set(["n8n", "--n8n", "evolution", "--evolution", "total", "--total"]);

export function parseDevLocalArgs(rawArgs: string[]): DevLocalOptions {
  const nextArgs: string[] = [];
  const errors: string[] = [];
  const requestedStacks = new Set<"evolution" | "n8n">();

  let skipClone = false;
  let clone = false;
  let noStart = false;
  let skipEvolution = false;
  let skipN8n = false;
  let forceTurbo = false;
  let fullSupabase = false;
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
    if (arg === "--hybrid") {
      hybridRequested = true;
      continue;
    }
    if (arg === "--db-only") {
      dbOnlyRequested = true;
      continue;
    }
    if (arg === "--skip-evo") {
      skipEvolution = true;
      continue;
    }
    if (arg === "--skip-n8n") {
      skipN8n = true;
      continue;
    }
    if (arg === "--turbo" || arg === "--turbopack") {
      forceTurbo = true;
      continue;
    }
    if (arg === "n8n" || arg === "--n8n") {
      requestedStacks.add("n8n");
      continue;
    }
    if (arg === "evolution" || arg === "--evolution") {
      requestedStacks.add("evolution");
      continue;
    }
    if (arg === "total" || arg === "--total") {
      requestedStacks.add("n8n");
      requestedStacks.add("evolution");
      continue;
    }

    nextArgs.push(arg);
  }

  if (requestedStacks.has("n8n") && skipN8n) {
    errors.push("Cannot request N8N and pass --skip-n8n at the same time.");
  }
  if (requestedStacks.has("evolution") && skipEvolution) {
    errors.push("Cannot request Evolution and pass --skip-evo at the same time.");
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

  const unknownStackLikeArgs = nextArgs.filter((arg) => {
    if (arg.startsWith("-")) return false;
    return OPTIONAL_STACK_ARGS.has(arg.toLowerCase());
  });
  if (unknownStackLikeArgs.length > 0) {
    errors.push(`Unexpected stack option: ${unknownStackLikeArgs.join(", ")}`);
  }

  const stackMode: LocalStackMode = hybridRequested ? "hybrid" : "db-only";

  return {
    skipClone,
    clone,
    noStart,
    forceTurbo,
    fullSupabase,
    stackMode,
    startEvolution: requestedStacks.has("evolution") && !skipEvolution,
    startN8n: requestedStacks.has("n8n") && !skipN8n,
    nextArgs,
    errors,
  };
}
