import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "app", "api");
const IMPORT =
  "import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';";
const RETHROW = "    rethrowIfPrerenderInterrupted(error);";

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
    lines.unshift(IMPORT);
    return lines.join("\n");
  }

  lines.splice(lastImportLine + 1, 0, IMPORT);
  return lines.join("\n");
}

function injectRethrowInCatchBlocks(source: string): string {
  return source.replace(
    /\} catch \(error\) \{\r?\n/g,
    `} catch (error) {\n${RETHROW}\n`
  );
}

function removeUnusedImport(source: string): string {
  if (!source.includes("rethrow-if-prerender-interrupted")) {
    return source;
  }
  if (source.includes("rethrowIfPrerenderInterrupted(error)")) {
    return source;
  }
  return source.replace(
    /^import \{ rethrowIfPrerenderInterrupted \} from '@\/lib\/http\/rethrow-if-prerender-interrupted';\r?\n/m,
    ""
  );
}

let updatedRethrow = 0;
let removedImport = 0;

for (const file of walk(ROOT)) {
  let source = readFileSync(file, "utf8");
  const original = source;

  if (source.includes("} catch (error) {")) {
    if (!source.includes("rethrowIfPrerenderInterrupted(error)")) {
      source = injectRethrowInCatchBlocks(source);
      source = insertImportAfterImportBlock(source);
      if (source !== original) updatedRethrow += 1;
    }
  } else {
    const cleaned = removeUnusedImport(source);
    if (cleaned !== source) {
      source = cleaned;
      removedImport += 1;
    }
  }

  if (source !== original) {
    writeFileSync(file, source);
  }
}

console.info(
  `[inject-prerender-rethrow] rethrow injected in ${updatedRethrow} file(s), removed unused import from ${removedImport} file(s)`
);
