import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "app", "api");
const RETHROW_IMPORT =
  "import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';";

const BROKEN_PATTERNS = [
  /import \{\r?\nimport \{ rethrowIfPrerenderInterrupted \} from '@\/lib\/http\/rethrow-if-prerender-interrupted';\r?\n/g,
];

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

function insertImportAfterImportBlock(source: string): string {
  if (source.includes("rethrow-if-prerender-interrupted")) {
    return source;
  }

  const lines = source.split(/\r?\n/);
  let lastImportLine = -1;
  let inMultilineImport = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^import\s/.test(line)) {
      lastImportLine = i;
      inMultilineImport = !line.includes(" from ");
      continue;
    }
    if (inMultilineImport) {
      lastImportLine = i;
      if (line.includes(" from ")) {
        inMultilineImport = false;
      }
      continue;
    }
    if (lastImportLine >= 0 && line.trim() === "") {
      continue;
    }
    if (lastImportLine >= 0) {
      break;
    }
  }

  if (lastImportLine < 0) {
    lines.unshift(RETHROW_IMPORT);
    return lines.join("\n");
  }

  lines.splice(lastImportLine + 1, 0, RETHROW_IMPORT);
  return lines.join("\n");
}

let fixed = 0;

for (const file of walk(ROOT)) {
  let source = readFileSync(file, "utf8");
  const original = source;

  for (const pattern of BROKEN_PATTERNS) {
    source = source.replace(pattern, "import {\n");
  }

  if (
    source.includes("rethrowIfPrerenderInterrupted") &&
    !source.includes("rethrow-if-prerender-interrupted")
  ) {
    source = insertImportAfterImportBlock(source);
  }

  if (source !== original) {
    writeFileSync(file, source);
    fixed += 1;
    console.info(`fixed ${file}`);
  }
}

console.info(`[fix-prerender-import-placement] fixed ${fixed} file(s)`);
