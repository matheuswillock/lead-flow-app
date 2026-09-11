#!/usr/bin/env bun

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, ".governance", "ai-governance.config.json");
const E2E_SPECS_DIR = path.join(ROOT, "e2e", "specs");

const RESPONSIVE_IMPORT_PATTERN = /from\s+["'][^"']*support\/responsive["']/;
const RESPONSIVE_CALL_PATTERN = /\brunResponsiveChecks\s*\(/;

interface GovernanceConfigForResponsive {
  legacyExceptions?: {
    responsiveSpecAllowlist?: string[];
  };
}

function normalizePathKey(value: string): string {
  return value.replaceAll("\\", "/");
}

/** Specs API-only (sem UI) são dispensadas do teste de responsividade. */
export function isApiOnlySpec(specFilename: string): boolean {
  return specFilename.endsWith("-api.spec.ts");
}

export function specHasResponsiveCoverage(specContent: string): boolean {
  return (
    RESPONSIVE_IMPORT_PATTERN.test(specContent) &&
    RESPONSIVE_CALL_PATTERN.test(specContent)
  );
}

async function collectSpecFilesRecursively(
  startDirectory: string,
): Promise<string[]> {
  const results: string[] = [];
  if (!(await pathExists(startDirectory))) {
    return results;
  }

  const stack: string[] = [startDirectory];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
        results.push(absolute);
      }
    }
  }

  return results.sort((a, b) => a.localeCompare(b));
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function toRepoPath(absolutePath: string): string {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

export async function validateResponsiveSpecCoverage(
  issues: string[],
  warnings: string[],
): Promise<void> {
  const config = JSON.parse(
    await fs.readFile(CONFIG_PATH, "utf8"),
  ) as GovernanceConfigForResponsive;

  const allowlist = new Set(
    (config.legacyExceptions?.responsiveSpecAllowlist ?? []).map(
      normalizePathKey,
    ),
  );

  const specFiles = await collectSpecFilesRecursively(E2E_SPECS_DIR);
  const violatingSpecs = new Set<string>();

  for (const absoluteSpec of specFiles) {
    const specPath = toRepoPath(absoluteSpec);
    const filename = path.basename(specPath);
    if (filename.startsWith("_") || isApiOnlySpec(filename)) {
      continue;
    }

    const content = await fs.readFile(absoluteSpec, "utf8");
    if (specHasResponsiveCoverage(content)) {
      continue;
    }

    violatingSpecs.add(specPath);
    if (!allowlist.has(specPath)) {
      issues.push(
        `Spec E2E sem teste de responsividade: ${specPath} — importe e chame runResponsiveChecks de e2e/support/responsive.ts (mobile-first). responsiveSpecAllowlist só encolhe.`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const exists = await pathExists(path.join(ROOT, allowlistedPath));
    if (!exists) {
      issues.push(
        `Legacy exception path does not exist (responsiveSpecAllowlist): ${allowlistedPath}`,
      );
      continue;
    }
    if (!violatingSpecs.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (spec already calls runResponsiveChecks): ${allowlistedPath}`,
      );
    }
  }
}
