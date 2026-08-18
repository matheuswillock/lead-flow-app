#!/usr/bin/env bun

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, ".governance", "ai-governance.config.json");
const APP_DIR = path.join(ROOT, "app");
const E2E_SPECS_DIR = path.join(ROOT, "e2e", "specs");

const FIXED_PAGE_EXCLUSIONS = new Set([
  "app/sentry-example-page/page.tsx",
  "app/auth/callback/page.tsx",
]);

interface E2ePageCoverageConfig {
  coveredBy?: Record<string, string>;
}

interface GovernanceConfigForE2e {
  legacyExceptions?: {
    e2ePageCoverageAllowlist?: string[];
  };
  e2ePageCoverage?: E2ePageCoverageConfig;
}

export function defaultSpecPathForPage(pagePath: string): string {
  const normalized = pagePath.replaceAll("\\", "/");
  const relative = normalized.replace(/^app\//, "").replace(/\/page\.tsx$/, "");
  const segments = relative
    .split("/")
    .filter((segment) => segment.length > 0 && !/^\([^)]+\)$/.test(segment))
    .map((segment) => {
      const dynamic = segment.match(/^\[(.+)\]$/);
      return dynamic ? dynamic[1] : segment;
    });

  if (segments[0] === "backoffice") {
    const rest = segments.slice(1);
    const slug = rest.length > 0 ? rest.join("/") : "home";
    return `e2e/specs/backoffice/${slug}.spec.ts`;
  }

  if (segments[0] === "supabaseId") {
    const rest = segments.slice(1);
    const slug = rest.length > 0 ? rest.join("/") : "home";
    return `e2e/specs/product/${slug}.spec.ts`;
  }

  if (
    segments[0] === "adesao" ||
    segments[0] === "addon-checkout" ||
    segments[0] === "checkout-return"
  ) {
    return `e2e/specs/checkout/${segments[0]}.spec.ts`;
  }

  const slug = segments.join("/") || "home";
  return `e2e/specs/public/${slug}.spec.ts`;
}

function normalizePathKey(value: string): string {
  return value.replaceAll("\\", "/");
}

async function collectFilesRecursively(
  startDirectory: string,
  filenameFilter: (filename: string, absolutePath: string) => boolean,
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
      if (entry.isFile() && filenameFilter(entry.name, absolute)) {
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

export async function validateE2ePageCoverage(
  issues: string[],
  warnings: string[],
): Promise<void> {
  const config = JSON.parse(
    await fs.readFile(CONFIG_PATH, "utf8"),
  ) as GovernanceConfigForE2e;

  const allowlist = new Set(
    (config.legacyExceptions?.e2ePageCoverageAllowlist ?? []).map(
      normalizePathKey,
    ),
  );
  const coveredBy = new Map(
    Object.entries(config.e2ePageCoverage?.coveredBy ?? {}).map(
      ([pagePath, specPath]) => [
        normalizePathKey(pagePath),
        normalizePathKey(specPath),
      ],
    ),
  );

  const pageFiles = await collectFilesRecursively(
    APP_DIR,
    (filename) => filename === "page.tsx",
  );

  const mappedSpecPaths = new Set<string>();

  for (const absolutePage of pageFiles) {
    const pagePath = toRepoPath(absolutePage);
    if (FIXED_PAGE_EXCLUSIONS.has(pagePath)) {
      continue;
    }

    if (allowlist.has(pagePath)) {
      mappedSpecPaths.add(defaultSpecPathForPage(pagePath));
      const mapped = coveredBy.get(pagePath);
      if (mapped) {
        mappedSpecPaths.add(mapped);
      }
      continue;
    }

    const specFromMap = coveredBy.get(pagePath);
    const specPath = specFromMap ?? defaultSpecPathForPage(pagePath);
    mappedSpecPaths.add(specPath);

    const specExists = await pathExists(path.join(ROOT, specPath));
    if (!specExists) {
      issues.push(
        `Página sem spec E2E: ${pagePath} (esperado ${specPath} ou entrada em e2ePageCoverage.coveredBy). Página nova MUST ter spec no mesmo PR; e2ePageCoverageAllowlist só encolhe.`,
      );
    }
  }

  const specFiles = await collectFilesRecursively(
    E2E_SPECS_DIR,
    (filename) => filename.endsWith(".spec.ts"),
  );

  for (const absoluteSpec of specFiles) {
    const specPath = toRepoPath(absoluteSpec);
    const filename = path.basename(specPath);
    if (filename.startsWith("_")) {
      continue;
    }
    if (!mappedSpecPaths.has(specPath)) {
      const referenced = [...coveredBy.values()].includes(specPath);
      if (!referenced) {
        warnings.push(
          `Spec E2E órfã (sem page.tsx / coveredBy correspondente): ${specPath}`,
        );
      }
    }
  }
}
