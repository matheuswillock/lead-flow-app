import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "app", "api");
const JSON_FLAG = process.argv.includes("--json");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, files);
      continue;
    }
    if (entry === "route.ts") files.push(path);
  }
  return files;
}

type Bucket = "needs-fix" | "already-fixed" | "has-dynamic-export" | "intentionally-cached" | "no-get";

function classify(source: string): Bucket {
  const hasGet = /export\s+(async\s+)?function\s+GET\s*\(/.test(source);
  if (!hasGet) return "no-get";

  if (source.includes("'use cache'") || source.includes('"use cache"')) {
    return "intentionally-cached";
  }

  // export const dynamic = "..." is incompatible with cacheComponents and breaks the build.
  if (/export\s+const\s+dynamic\s*=/.test(source)) {
    return "has-dynamic-export";
  }

  if (/await\s+connection\s*\(\s*\)/.test(source)) {
    return "already-fixed";
  }

  return "needs-fix";
}

const results: Record<Bucket, string[]> = {
  "needs-fix": [],
  "already-fixed": [],
  "has-dynamic-export": [],
  "intentionally-cached": [],
  "no-get": [],
};

for (const file of walk(ROOT)) {
  const source = readFileSync(file, "utf8");
  results[classify(source)].push(file);
}

if (JSON_FLAG) {
  console.info(JSON.stringify(results, null, 2));
} else {
  console.info("[audit-api-route-dynamic] resumo:");
  for (const bucket of Object.keys(results) as Bucket[]) {
    console.info(`  ${bucket}: ${results[bucket].length}`);
  }

  if (results["needs-fix"].length > 0) {
    console.info("\n[audit-api-route-dynamic] needs-fix:");
    for (const file of results["needs-fix"]) console.info(`  ${file}`);
  }

  if (results["has-dynamic-export"].length > 0) {
    console.info("\n[audit-api-route-dynamic] has-dynamic-export (quebra o build sob cacheComponents, remover):");
    for (const file of results["has-dynamic-export"]) console.info(`  ${file}`);
  }

  if (results["intentionally-cached"].length > 0) {
    console.info("\n[audit-api-route-dynamic] intentionally-cached (excluídas do fix):");
    for (const file of results["intentionally-cached"]) console.info(`  ${file}`);
  }
}

if (results["has-dynamic-export"].length > 0) {
  process.exit(1);
}
