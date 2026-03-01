#!/usr/bin/env bun

import { promises as fs } from "node:fs";
import path from "node:path";

type AdapterKind = "copilot" | "github" | "cursor" | "claude" | "codex";
type Command = "check" | "sync-adapters" | "warn-allowlist";

interface CanonicalConfig {
  path: string;
  requiredKeywords?: string[];
}

interface AdapterConfig {
  path: string;
  kind: AdapterKind;
}

interface WarningsConfig {
  maxExamplesPerCategory?: number;
}

interface LegacyExceptionsConfig {
  [category: string]: string[] | undefined;
  prismaInV1RouteAllowlist?: string[];
  useCaseWithoutOutputAllowlist?: string[];
  frontendFeatureStructureAllowlist?: string[];
  nonTypeScriptFileAllowlist?: string[];
}

interface GovernanceConfig {
  canonical: CanonicalConfig;
  adapters: AdapterConfig[];
  warnings?: WarningsConfig;
  legacyExceptions: LegacyExceptionsConfig;
}

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, ".governance", "ai-governance.config.json");
const DEFAULT_MAX_EXAMPLES = 5;
const NON_TS_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".py"]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "coverage",
  "test-results",
]);

function normalizeRelativePath(absolutePath: string): string {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function toAbsolutePath(relativePath: string): string {
  return path.join(ROOT, ...relativePath.split("/"));
}

function isSamePath(pathA: string, pathB: string): boolean {
  const resolvedA = path.resolve(pathA);
  const resolvedB = path.resolve(pathB);
  if (process.platform === "win32") {
    return resolvedA.toLowerCase() === resolvedB.toLowerCase();
  }
  return resolvedA === resolvedB;
}

function getMaxExamples(config: GovernanceConfig): number {
  const value = config.warnings?.maxExamplesPerCategory;
  if (!value || !Number.isInteger(value) || value <= 0) {
    return DEFAULT_MAX_EXAMPLES;
  }
  return value;
}

function normalizePathList(entries: string[] | undefined): Set<string> {
  return new Set((entries ?? []).map((entry) => entry.replaceAll("\\", "/")));
}

function getLegacyExceptionEntries(
  config: GovernanceConfig,
): Array<[string, string[]]> {
  return Object.entries(config.legacyExceptions).filter(
    ([, value]) => Array.isArray(value),
  ) as Array<[string, string[]]>;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
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

async function collectRepoNonTypeScriptFiles(): Promise<string[]> {
  const matches: string[] = [];
  const stack: string[] = [ROOT];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        stack.push(absolute);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (NON_TS_EXTENSIONS.has(extension)) {
        matches.push(absolute);
      }
    }
  }

  return matches.sort((a, b) => a.localeCompare(b));
}

function renderAdapterContent(
  config: GovernanceConfig,
  adapter: AdapterConfig,
  sourceContent: string,
): string {
  const baseHeader = [
    "<!-- GENERATED FILE - DO NOT EDIT DIRECTLY -->",
    `<!-- Source: ${config.canonical.path} -->`,
    "<!-- Regenerate with: bun run governance:sync -->",
    "",
  ].join("\n");

  if (adapter.kind === "cursor") {
    return [
      "---",
      "description: Lead Flow canonical implementation rules",
      "alwaysApply: true",
      "---",
      "",
      baseHeader,
      sourceContent.trimEnd(),
      "",
    ].join("\n");
  }

  return [baseHeader, sourceContent.trimEnd(), ""].join("\n");
}

async function syncAdapters(
  config: GovernanceConfig,
  canonicalText: string,
  canonicalAbsolutePath: string,
): Promise<void> {
  for (const adapter of config.adapters) {
    const targetAbsolutePath = toAbsolutePath(adapter.path);
    if (isSamePath(targetAbsolutePath, canonicalAbsolutePath)) {
      console.info(
        "[governance:sync] Skipped",
        adapter.path,
        "(same file as canonical source on this filesystem)",
      );
      continue;
    }
    await fs.mkdir(path.dirname(targetAbsolutePath), { recursive: true });
    await fs.writeFile(
      targetAbsolutePath,
      renderAdapterContent(config, adapter, canonicalText),
      "utf8",
    );
    console.info("[governance:sync] Updated", adapter.path);
  }
}

function validateCanonicalMetadata(
  config: GovernanceConfig,
  canonicalText: string,
  issues: string[],
): void {
  if (!/^\*\*Version:\*\*\s*\S+/m.test(canonicalText)) {
    issues.push(
      `${config.canonical.path}: missing "**Version:**" metadata line.`,
    );
  }

  if (!/^\*\*Last Updated:\*\*\s*\d{4}-\d{2}-\d{2}/m.test(canonicalText)) {
    issues.push(
      `${config.canonical.path}: missing or invalid "**Last Updated:** YYYY-MM-DD" metadata line.`,
    );
  }

  for (const requiredKeyword of config.canonical.requiredKeywords ?? []) {
    if (!canonicalText.includes(requiredKeyword)) {
      issues.push(
        `${config.canonical.path}: missing required keyword "${requiredKeyword}".`,
      );
    }
  }
}

async function validateAdapters(
  config: GovernanceConfig,
  canonicalText: string,
  canonicalAbsolutePath: string,
  issues: string[],
): Promise<void> {
  for (const adapter of config.adapters) {
    const absolutePath = toAbsolutePath(adapter.path);
    if (isSamePath(absolutePath, canonicalAbsolutePath)) {
      if (!(await pathExists(canonicalAbsolutePath))) {
        issues.push(
          `Canonical/adaptor shared path missing: ${adapter.path} (${config.canonical.path})`,
        );
      }
      continue;
    }
    const expected = renderAdapterContent(config, adapter, canonicalText);

    if (!(await pathExists(absolutePath))) {
      issues.push(`Missing adapter file: ${adapter.path}`);
      continue;
    }

    const current = await fs.readFile(absolutePath, "utf8");
    if (current !== expected) {
      issues.push(
        `Adapter out of sync: ${adapter.path}. Run "bun run governance:sync".`,
      );
    }
  }
}

async function validatePrismaInV1Routes(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const allowlist = normalizePathList(
    config.legacyExceptions.prismaInV1RouteAllowlist,
  );

  const routeFiles = await collectFilesRecursively(
    path.join(ROOT, "app", "api", "v1"),
    (filename) => filename === "route.ts",
  );

  const currentViolations = new Set<string>();

  for (const routeFile of routeFiles) {
    const relative = normalizeRelativePath(routeFile);
    const fileContent = await fs.readFile(routeFile, "utf8");

    if (!/\bprisma\b/.test(fileContent)) {
      continue;
    }

    currentViolations.add(relative);
    if (!allowlist.has(relative)) {
      issues.push(
        `Disallowed direct Prisma usage in v1 route: ${relative}. Move data access to UseCase/Service or add justified LEGACY EXCEPTION in config.`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (prismaInV1RouteAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (no Prisma detected anymore): ${allowlistedPath}`,
      );
    }
  }
}

function hasOutputContract(fileContent: string): boolean {
  return (
    /\bnew\s+Output\s*\(/.test(fileContent) ||
    /Promise<\s*Output\s*>/.test(fileContent) ||
    /\bOutput\.fromOutputResult\s*\(/.test(fileContent)
  );
}

async function validateUseCaseOutputContract(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const allowlist = normalizePathList(
    config.legacyExceptions.useCaseWithoutOutputAllowlist,
  );

  const useCaseFiles = await collectFilesRecursively(
    path.join(ROOT, "app", "api", "useCases"),
    (filename) =>
      filename.endsWith("UseCase.ts") && !/^I[A-Z].*UseCase\.ts$/.test(filename),
  );

  const currentViolations = new Set<string>();

  for (const useCaseFile of useCaseFiles) {
    const relative = normalizeRelativePath(useCaseFile);
    const fileContent = await fs.readFile(useCaseFile, "utf8");

    if (hasOutputContract(fileContent)) {
      continue;
    }

    currentViolations.add(relative);
    if (!allowlist.has(relative)) {
      issues.push(
        `New UseCase without Output contract: ${relative}. Return Output or add justified LEGACY EXCEPTION in config.`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (useCaseWithoutOutputAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (Output contract detected): ${allowlistedPath}`,
      );
    }
  }
}

async function validateFrontendFeatureStructure(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const featureRoot = path.join(ROOT, "app", "[supabaseId]");
  const allowlist = normalizePathList(
    config.legacyExceptions.frontendFeatureStructureAllowlist,
  );

  if (!(await pathExists(featureRoot))) {
    return;
  }

  const entries = await fs.readdir(featureRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const featureDirectory = path.join(featureRoot, entry.name);
    const pagePath = path.join(featureDirectory, "page.tsx");
    if (!(await pathExists(pagePath))) {
      continue;
    }

    const relativeFeaturePath = normalizeRelativePath(featureDirectory);
    if (allowlist.has(relativeFeaturePath)) {
      continue;
    }

    const requiredPaths = [
      path.join(featureDirectory, "features", "context"),
      path.join(featureDirectory, "features", "services"),
      path.join(featureDirectory, "features", "container"),
    ];

    const missing: string[] = [];
    for (const requiredPath of requiredPaths) {
      if (!(await isDirectory(requiredPath))) {
        missing.push(normalizeRelativePath(requiredPath));
      }
    }

    if (missing.length > 0) {
      issues.push(
        `Feature structure violation in ${relativeFeaturePath}. Missing: ${missing.join(
          ", ",
        )}`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      warnings.push(
        `Legacy frontend allowlist path not found: ${allowlistedPath}`,
      );
    }
  }
}

async function validateNonTypeScriptFiles(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const allowlist = normalizePathList(
    config.legacyExceptions.nonTypeScriptFileAllowlist,
  );
  const files = await collectRepoNonTypeScriptFiles();
  const foundAllowlisted = new Set<string>();

  for (const absoluteFile of files) {
    const relative = normalizeRelativePath(absoluteFile);
    if (allowlist.has(relative)) {
      foundAllowlisted.add(relative);
      continue;
    }

    issues.push(
      `Arquivo não-TS detectado fora de allowlist: ${relative}. Converta para TS ou adicione como LEGACY EXCEPTION no config.`,
    );
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (nonTypeScriptFileAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!foundAllowlisted.has(allowlistedPath)) {
      warnings.push(
        `Legacy non-TS exception may be removable (file not found by scanner): ${allowlistedPath}`,
      );
    }
  }
}

function formatLegacyWarning(
  category: string,
  entries: string[],
  maxExamples: number,
): string {
  const examples = entries.slice(0, maxExamples);
  const remainder = Math.max(0, entries.length - examples.length);
  const suffix = remainder > 0 ? ` (+${remainder} more)` : "";
  const preview = examples.length > 0 ? examples.join(", ") : "no entries";
  return `[${category}] ${entries.length} legacy item(s). Update these items to follow governance. Examples: ${preview}${suffix}`;
}

function printAllowlistWarnings(config: GovernanceConfig): void {
  const entries = getLegacyExceptionEntries(config);
  const maxExamples = getMaxExamples(config);
  const categoryCount = entries.length;
  const totalItems = entries.reduce((sum, [, paths]) => sum + paths.length, 0);

  console.warn(
    `::warning title=Governance Allowlist Summary::${categoryCount} category(ies), ${totalItems} total legacy item(s). These should be migrated to governance standards.`,
  );

  for (const [category, paths] of entries) {
    console.warn(
      `::warning title=Governance Allowlist::${formatLegacyWarning(
        category,
        paths,
        maxExamples,
      )}`,
    );
  }
}

async function checkGovernance(
  config: GovernanceConfig,
  canonicalText: string,
  canonicalAbsolutePath: string,
): Promise<void> {
  const issues: string[] = [];
  const warnings: string[] = [];

  validateCanonicalMetadata(config, canonicalText, issues);
  await validateAdapters(config, canonicalText, canonicalAbsolutePath, issues);
  await validatePrismaInV1Routes(config, issues, warnings);
  await validateUseCaseOutputContract(config, issues, warnings);
  await validateFrontendFeatureStructure(config, issues, warnings);
  await validateNonTypeScriptFiles(config, issues, warnings);

  if (warnings.length > 0) {
    console.warn("\n[governance:check] WARNINGS");
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (issues.length > 0) {
    console.error("\n[governance:check] FAILED");
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    process.exit(1);
  }

  console.info("[governance:check] OK");
}

async function main(): Promise<void> {
  const validCommands = new Set<Command>([
    "check",
    "sync-adapters",
    "warn-allowlist",
  ]);
  const maybeCommand = (process.argv[2] ?? "check") as Command;

  if (!validCommands.has(maybeCommand)) {
    console.error("Unknown command:", maybeCommand);
    console.error(
      "Usage: bun scripts/ai-governance.ts [check|sync-adapters|warn-allowlist]",
    );
    process.exit(1);
  }

  const config = JSON.parse(
    await fs.readFile(CONFIG_PATH, "utf8"),
  ) as GovernanceConfig;
  const canonicalPath = path.join(ROOT, config.canonical.path);
  const canonicalText = await fs.readFile(canonicalPath, "utf8");

  if (maybeCommand === "sync-adapters") {
    await syncAdapters(config, canonicalText, canonicalPath);
    return;
  }

  if (maybeCommand === "warn-allowlist") {
    printAllowlistWarnings(config);
    return;
  }

  await checkGovernance(config, canonicalText, canonicalPath);
}

main().catch((error: unknown) => {
  console.error("[governance] Fatal error:", error);
  process.exit(1);
});
