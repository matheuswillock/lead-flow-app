import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "app", "api");

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

function needsFix(source: string): boolean {
  const hasGet = /export\s+(async\s+)?function\s+GET\s*\(/.test(source);
  if (!hasGet) return false;
  if (source.includes("'use cache'") || source.includes('"use cache"')) return false;
  if (/export\s+const\s+dynamic\s*=/.test(source)) return false;
  if (/await\s+connection\s*\(\s*\)/.test(source)) return false;
  return true;
}

/** Localiza o índice do `{` que abre o corpo de `export async function GET(...)`,
 * balanceando parênteses para lidar com assinaturas multilinha e tipos genéricos. */
function findGetBodyOpenBraceIndex(source: string): number {
  const signatureStart = source.search(/export\s+(async\s+)?function\s+GET\s*\(/);
  if (signatureStart < 0) return -1;

  const openParenIndex = source.indexOf("(", signatureStart);
  let depth = 0;
  let i = openParenIndex;
  for (; i < source.length; i++) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return -1;

  // Após o `)` de fechamento, pula possível anotação de tipo de retorno até o `{`.
  const braceIndex = source.indexOf("{", i + 1);
  return braceIndex;
}

function insertConnectionCall(source: string): string {
  const braceIndex = findGetBodyOpenBraceIndex(source);
  if (braceIndex < 0) return source;

  const before = source.slice(0, braceIndex + 1);
  const after = source.slice(braceIndex + 1);
  return `${before}\n  await connection();\n${after}`;
}

function ensureConnectionImport(source: string): string {
  const nextServerImportMatch = source.match(/import\s*\{([^}]*)\}\s*from\s*["']next\/server["'];?/);
  if (nextServerImportMatch) {
    const specifiers = nextServerImportMatch[1];
    if (/\bconnection\b/.test(specifiers)) return source;
    const trimmed = specifiers.trim();
    const updated = `import {${trimmed ? ` ${trimmed}, connection ` : " connection "}} from "next/server";`;
    return source.replace(nextServerImportMatch[0], updated);
  }

  // Sem import de next/server: adiciona um novo logo antes do primeiro import existente.
  const firstImportMatch = source.match(/^import\s/m);
  if (firstImportMatch && firstImportMatch.index !== undefined) {
    return (
      source.slice(0, firstImportMatch.index) +
      'import { connection } from "next/server";\n' +
      source.slice(firstImportMatch.index)
    );
  }

  return `import { connection } from "next/server";\n${source}`;
}

let fixed = 0;

for (const file of walk(ROOT)) {
  const source = readFileSync(file, "utf8");
  if (!needsFix(source)) continue;

  const withImport = ensureConnectionImport(source);
  const withCall = insertConnectionCall(withImport);
  if (withCall === source) continue;

  writeFileSync(file, withCall);
  fixed += 1;
}

console.info(`[inject-force-dynamic] await connection() inserido em ${fixed} arquivo(s)`);
