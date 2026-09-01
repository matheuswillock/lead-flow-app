#!/usr/bin/env bun

import { promises as fs } from "node:fs";
import path from "node:path";
import { validateE2ePageCoverage } from "./check-e2e-pages";

type AdapterKind = "copilot" | "github" | "cursor" | "claude" | "codex";
type Command =
  | "check"
  | "check-api-masking"
  | "check-e2e-pages"
  | "sync-adapters"
  | "warn-allowlist";

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
  dipPrismaInUseCaseAllowlist?: string[];
  useCaseWithoutOutputAllowlist?: string[];
  frontendFeatureStructureAllowlist?: string[];
  nonTypeScriptFileAllowlist?: string[];
  routeRepositoryImportAllowlist?: string[];
  routeHttpRequestAllowlist?: string[];
  useCaseHttpRequestAllowlist?: string[];
  repositoryHttpRequestAllowlist?: string[];
  serviceImportOutsideUseCaseAllowlist?: string[];
  nonRepositoryDatabaseAccessAllowlist?: string[];
  prismaIncludeAllowlist?: string[];
  e2ePageCoverageAllowlist?: string[];
  /** Client-side files still hardcoding `/api/v1/` instead of `API_CLIENT_BASE`. */
  clientApiPathMaskingAllowlist?: string[];
}

interface E2ePageCoverageConfig {
  coveredBy?: Record<string, string>;
}

interface GovernanceConfig {
  canonical: CanonicalConfig;
  adapters: AdapterConfig[];
  warnings?: WarningsConfig;
  legacyExceptions: LegacyExceptionsConfig;
  e2ePageCoverage?: E2ePageCoverageConfig;
}

interface AllowlistMonitoringConfig {
  excludeFromWarnAllowlist?: Record<string, string[] | undefined>;
}

interface FrozenAllowlistsConfig {
  [category: string]: string[] | undefined;
}

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, ".governance", "ai-governance.config.json");
const MONITORING_CONFIG_PATH = path.join(
  ROOT,
  ".governance",
  "allowlist-monitoring.config.json",
);
const FROZEN_ALLOWLISTS_CONFIG_PATH = path.join(
  ROOT,
  ".governance",
  "frozen-allowlists.json",
);
const DEFAULT_MAX_EXAMPLES = 5;
const NON_TS_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".py"]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "coverage",
  "test-results",
  "worktrees", // Claude Code worktrees — temporary isolated copies, not project code
  // Agent tool configuration directories — not project source code
  ".agents",
  ".claude",
  ".codestudio",
  ".commandcode",
  ".continue",
  ".hermes",
  ".mcpjam",
  ".openhands",
  ".tabnine",
  ".windsurf",
  ".zencoder",
  "skills", // top-level plugin skill reference files
]);

interface FrontendPatternRequirement {
  directorySegments: string[];
  label: string;
  matcher: RegExp;
}

const FRONTEND_REQUIRED_DIRECTORIES = [
  ["features", "context"],
  ["features", "services"],
  ["features", "container"],
];

const FRONTEND_REQUIRED_FILES = ["loading.tsx"];

const FRONTEND_PATTERN_REQUIREMENTS: FrontendPatternRequirement[] = [
  {
    directorySegments: ["features", "context"],
    label: "features/context/*Types.ts",
    matcher: /^[A-Za-z0-9._-]+Types\.ts$/,
  },
  {
    directorySegments: ["features", "context"],
    label: "features/context/*Hook.ts",
    matcher: /^[A-Za-z0-9._-]+Hook\.ts$/,
  },
  {
    directorySegments: ["features", "context"],
    label: "features/context/*Context.tsx",
    matcher: /^[A-Za-z0-9._-]+Context\.tsx$/,
  },
  {
    directorySegments: ["features", "services"],
    label: "features/services/I*Service.ts",
    matcher: /^I[A-Za-z0-9._-]+Service(?:s)?\.ts$/,
  },
  {
    directorySegments: ["features", "services"],
    label: "features/services/*Service.ts",
    matcher: /^(?!I[A-Z])[A-Za-z0-9._-]+Service\.ts$/,
  },
  {
    directorySegments: ["features", "container"],
    label: "features/container/*Container.tsx",
    matcher: /^[A-Za-z0-9._-]+Container\.tsx$/,
  },
];

const FRONTEND_BROWSER_DIALOG_SCAN_DIRECTORIES = [
  "app",
  "components",
  "hooks",
  "lib",
];
const FRONTEND_SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const WINDOW_BROWSER_DIALOG_REGEX = /\bwindow\s*\.\s*(alert|confirm|prompt)\s*\(/;
const GLOBAL_BROWSER_DIALOG_REGEX = /(^|[^.\w$])(alert|confirm|prompt)\s*\(/;
const STATIC_IMPORT_SPECIFIER_REGEX =
  /\b(?:import|export)\s+(?:type\s+)?(?:[\w*\s{},]+\s+from\s*)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT_SPECIFIER_REGEX = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const FETCH_REQUEST_REGEX = /\bfetch\s*\(/;
const AXIOS_REQUEST_REGEX = /\baxios\s*(?:\(|\.)/;
/**
 * Hardcoded product API path in client-side source (must use API_CLIENT_BASE).
 * Matches both quoted roots (`'/api/v1/...'`, `` `/api/v1/...` ``) and path
 * segments after an interpolated/absolute origin
 * (`${this.baseUrl}/api/v1/...`, `https://host/api/v1/...`).
 */
const HARDCODED_API_V1_PATH_REGEX = /\/api\/v1(?:\/|['"`]|$)/;
const API_V1_MODULE_IMPORT_REGEX =
  /(?:from\s+|import\s*\(\s*)['"][^'"]*\/api\/v1(?:\/|['"])/;
const SERVER_ONLY_MODULE_REGEX =
  /(?:^|\n)\s*(?:import\s+['"]server-only['"]|['"]use server['"]|["']use server["'])/;
const CLIENT_API_MASKING_SCAN_DIRECTORIES = ["app", "components", "hooks", "lib"];
const CLIENT_API_MASKING_EXCLUDED_PATH_PREFIXES = [
  "app/api/",
  "lib/route-map/",
];

/** `<receiver>.$queryRaw` / `$executeRaw` / `$transaction` — client-level API. */
const PRISMA_CLIENT_API_REGEX =
  /[\w$)\]]\s*\.\s*\$(?:queryRaw|executeRaw|transaction)/;
/** Direct access through the shared client exported as `prisma`. */
const PRISMA_LITERAL_ACCESS_REGEX = /\bprisma\s*\./;
/** Identifiers annotated with a Prisma client/transaction type. */
const PRISMA_TYPED_IDENTIFIER_REGEX =
  /\b([A-Za-z_$][\w$]*)\s*[?!]?\s*:\s*(?:Omit<\s*)?(?:PrismaClient|PrismaTransactionClient|Prisma\.TransactionClient|TransactionClient)\b/g;
/**
 * Identifiers holding the client without a type annotation: aliases of the
 * shared export (`const db = prisma`) and factory calls
 * (`const db = getEmailCronPrisma()`).
 */
const PRISMA_ALIAS_IDENTIFIER_REGEX =
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(?:prisma\b|[\w.]*[Pp]risma[\w]*\s*\()|\bthis\.([A-Za-z_$][\w$]*)\s*=\s*(?:prisma\b|[\w.]*[Pp]risma[\w]*\s*\()/g;
/** Transaction callback parameter (`$transaction(async (tx) => ...)`). */
const PRISMA_TRANSACTION_PARAM_REGEX =
  /\$transaction\(\s*(?:async\s*)?\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>/g;

/** Prisma client identifiers other than the literal `prisma` export. */
function collectInjectedPrismaIdentifiers(fileContent: string): Set<string> {
  const identifiers = new Set<string>();

  const addIdentifier = (identifier: string | undefined): void => {
    if (identifier && identifier !== "prisma") {
      identifiers.add(identifier);
    }
  };

  for (const match of fileContent.matchAll(PRISMA_TYPED_IDENTIFIER_REGEX)) {
    addIdentifier(match[1]);
  }

  for (const match of fileContent.matchAll(PRISMA_ALIAS_IDENTIFIER_REGEX)) {
    addIdentifier(match[1] ?? match[2]);
  }

  for (const match of fileContent.matchAll(PRISMA_TRANSACTION_PARAM_REGEX)) {
    addIdentifier(match[1]);
  }

  return identifiers;
}

/**
 * Property access on an identifier already established as a Prisma client
 * (`this.db.`, `db.`, `deps.db.`), so the receiver is never inferred from the
 * property name — `cache.lead.count()` is not database access.
 */
function accessesInjectedPrismaClient(fileContent: string): boolean {
  for (const identifier of collectInjectedPrismaIdentifiers(fileContent)) {
    const escaped = identifier.replaceAll("$", "\\$");
    const accessRegex = new RegExp(
      `(?<![\\w$])(?:[A-Za-z_$][\\w$]*\\s*\\.\\s*)?${escaped}\\s*\\.\\s*[A-Za-z_$]`,
    );

    if (accessRegex.test(fileContent)) {
      return true;
    }
  }

  return false;
}

/**
 * Detects Prisma data access through any accessor: the shared `prisma` export,
 * a client injected in the constructor (`this.db.`), a transaction client
 * (`tx.`), or any identifier typed as `PrismaClient`.
 */
export function containsPrismaDataAccess(fileContent: string): boolean {
  if (
    PRISMA_LITERAL_ACCESS_REGEX.test(fileContent) ||
    PRISMA_CLIENT_API_REGEX.test(fileContent)
  ) {
    return true;
  }

  return accessesInjectedPrismaClient(fileContent);
}

function extractImportSpecifiers(fileContent: string): string[] {
  const specifiers = new Set<string>();

  for (const match of fileContent.matchAll(STATIC_IMPORT_SPECIFIER_REGEX)) {
    const specifier = match[1]?.trim();
    if (specifier) {
      specifiers.add(specifier);
    }
  }

  for (const match of fileContent.matchAll(DYNAMIC_IMPORT_SPECIFIER_REGEX)) {
    const specifier = match[1]?.trim();
    if (specifier) {
      specifiers.add(specifier);
    }
  }

  return Array.from(specifiers);
}

function containsServiceImport(fileContent: string): boolean {
  return extractImportSpecifiers(fileContent).some((specifier) =>
    specifier.includes("/services/"),
  );
}

function containsRepositoryImport(fileContent: string): boolean {
  return extractImportSpecifiers(fileContent).some(
    (specifier) =>
      specifier.includes("/repositories/") ||
      specifier.includes("infra/data/repositories/"),
  );
}

function containsHttpRequestCall(fileContent: string): boolean {
  return (
    FETCH_REQUEST_REGEX.test(fileContent) || AXIOS_REQUEST_REGEX.test(fileContent)
  );
}

function normalizeRelativePath(absolutePath: string): string {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function toAbsolutePath(relativePath: string): string {
  return path.join(ROOT, ...relativePath.split("/"));
}

// review #1113 (P1): um `.toLowerCase()` cego tratava AGENTS.md e agents.md
// como o mesmo arquivo em QUALQUER filesystem, inclusive case-sensitive (Linux),
// onde são dois arquivos de verdade — o adapter AGENTS.md nunca era sincronizado.
// Só pula a escrita quando o SO confirma que os dois caminhos resolvem para o
// mesmo inode (filesystem case-insensitive de verdade, ex.: macOS/Windows).
export async function isSamePath(
  pathA: string,
  pathB: string,
): Promise<boolean> {
  const resolvedA = path.resolve(pathA);
  const resolvedB = path.resolve(pathB);
  if (resolvedA === resolvedB) return true;
  if (resolvedA.toLowerCase() !== resolvedB.toLowerCase()) return false;

  try {
    const [statA, statB] = await Promise.all([
      fs.stat(resolvedA),
      fs.stat(resolvedB),
    ]);
    return statA.dev === statB.dev && statA.ino === statB.ino;
  } catch {
    return false;
  }
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

async function loadAllowlistMonitoringConfig(): Promise<AllowlistMonitoringConfig> {
  if (!(await pathExists(MONITORING_CONFIG_PATH))) {
    return {};
  }

  return JSON.parse(
    await fs.readFile(MONITORING_CONFIG_PATH, "utf8"),
  ) as AllowlistMonitoringConfig;
}

async function loadFrozenAllowlistsConfig(): Promise<FrozenAllowlistsConfig> {
  if (!(await pathExists(FROZEN_ALLOWLISTS_CONFIG_PATH))) {
    return {};
  }

  return JSON.parse(
    await fs.readFile(FROZEN_ALLOWLISTS_CONFIG_PATH, "utf8"),
  ) as FrozenAllowlistsConfig;
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function directoryHasMatchingFile(
  directoryPath: string,
  matcher: RegExp,
): Promise<boolean> {
  if (!(await isDirectory(directoryPath))) {
    return false;
  }

  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries.some((entry) => entry.isFile() && matcher.test(entry.name));
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

async function collectFrontendSourceFiles(): Promise<string[]> {
  const found = new Set<string>();

  for (const rootDirectory of FRONTEND_BROWSER_DIALOG_SCAN_DIRECTORIES) {
    const absoluteRoot = path.join(ROOT, rootDirectory);
    const files = await collectFilesRecursively(
      absoluteRoot,
      (_filename, absolutePath) => {
        const extension = path.extname(absolutePath).toLowerCase();
        return FRONTEND_SOURCE_EXTENSIONS.has(extension);
      },
    );

    for (const file of files) {
      found.add(file);
    }
  }

  return Array.from(found).sort((a, b) => a.localeCompare(b));
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
    if (await isSamePath(targetAbsolutePath, canonicalAbsolutePath)) {
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
    if (await isSamePath(absolutePath, canonicalAbsolutePath)) {
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

async function validateNoPrismaInUseCase(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const allowlist = normalizePathList(
    config.legacyExceptions.dipPrismaInUseCaseAllowlist,
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

    const usesPrisma =
      /\$queryRaw|\$executeRaw/.test(fileContent) ||
      containsPrismaDataAccess(fileContent);

    if (!usesPrisma) {
      continue;
    }

    currentViolations.add(relative);
    if (!allowlist.has(relative)) {
      issues.push(
        `Disallowed direct Prisma usage in UseCase (violates DIP): ${relative}. Move data access to a Service/Repository or add justified LEGACY EXCEPTION in config.`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (dipPrismaInUseCaseAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (no direct Prisma detected anymore): ${allowlistedPath}`,
      );
    }
  }
}

async function validatePrismaIncludeUsage(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const allowlist = normalizePathList(
    config.legacyExceptions.prismaIncludeAllowlist,
  );

  const apiFiles = await collectFilesRecursively(
    path.join(ROOT, "app", "api"),
    (filename) => filename.endsWith(".ts"),
  );

  const currentViolations = new Set<string>();

  for (const apiFile of apiFiles) {
    const relative = normalizeRelativePath(apiFile);
    const fileContent = await fs.readFile(apiFile, "utf8");

    if (!/\binclude\s*:/.test(fileContent)) {
      continue;
    }

    if (!containsPrismaDataAccess(fileContent)) {
      continue;
    }

    currentViolations.add(relative);
    if (!allowlist.has(relative)) {
      issues.push(
        `Uso de Prisma include detectado fora da exceção: ${relative}. Prefira select e selecione apenas os campos necessários.`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (prismaIncludeAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (prisma include no longer detected): ${allowlistedPath}`,
      );
    }
  }
}

function validateFrozenAllowlistsNoNewItems(
  config: GovernanceConfig,
  frozenAllowlists: FrozenAllowlistsConfig,
  issues: string[],
): void {
  for (const [category, frozenEntries] of Object.entries(frozenAllowlists)) {
    if (!Array.isArray(frozenEntries)) {
      continue;
    }

    const currentEntries = config.legacyExceptions[category] ?? [];
    const frozenSet = new Set(
      frozenEntries.map((entry) => entry.replaceAll("\\", "/")),
    );
    const currentSet = new Set(
      currentEntries.map((entry) => entry.replaceAll("\\", "/")),
    );

    for (const currentEntry of currentSet) {
      if (!frozenSet.has(currentEntry)) {
        issues.push(
          `Categoria de exceção congelada recebeu novo item: ${category} -> ${currentEntry}. Novos itens não são permitidos.`,
        );
      }
    }
  }
}

async function validateRouteRepositoryImports(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const allowlist = normalizePathList(
    config.legacyExceptions.routeRepositoryImportAllowlist,
  );

  const routeFiles = await collectFilesRecursively(
    path.join(ROOT, "app", "api", "v1"),
    (filename) => filename === "route.ts",
  );

  const currentViolations = new Set<string>();

  for (const routeFile of routeFiles) {
    const relative = normalizeRelativePath(routeFile);
    const fileContent = await fs.readFile(routeFile, "utf8");

    if (!containsRepositoryImport(fileContent)) {
      continue;
    }

    currentViolations.add(relative);
    if (!allowlist.has(relative)) {
      issues.push(
        `Route importando Repository diretamente: ${relative}. Route deve chamar apenas UseCase (e libs de autenticação).`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (routeRepositoryImportAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (route no longer imports Repository): ${allowlistedPath}`,
      );
    }
  }
}

async function validateServiceImportsOutsideUseCases(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const allowlist = normalizePathList(
    config.legacyExceptions.serviceImportOutsideUseCaseAllowlist,
  );

  const apiFiles = await collectFilesRecursively(
    path.join(ROOT, "app", "api"),
    (filename) => filename.endsWith(".ts"),
  );

  const currentViolations = new Set<string>();

  for (const apiFile of apiFiles) {
    const relative = normalizeRelativePath(apiFile);

    if (relative.startsWith("app/api/useCases/")) {
      continue;
    }

    const fileContent = await fs.readFile(apiFile, "utf8");
    if (!containsServiceImport(fileContent)) {
      continue;
    }

    currentViolations.add(relative);
    if (!allowlist.has(relative)) {
      issues.push(
        `Import de Service fora de UseCase detectado: ${relative}. Service deve ser chamado apenas pela camada de UseCase.`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (serviceImportOutsideUseCaseAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (service import outside UseCase no longer detected): ${allowlistedPath}`,
      );
    }
  }
}

async function validateHttpRequestBoundaries(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const routeAllowlist = normalizePathList(
    config.legacyExceptions.routeHttpRequestAllowlist,
  );
  const useCaseAllowlist = normalizePathList(
    config.legacyExceptions.useCaseHttpRequestAllowlist,
  );
  const repositoryAllowlist = normalizePathList(
    config.legacyExceptions.repositoryHttpRequestAllowlist,
  );

  const routeFiles = await collectFilesRecursively(
    path.join(ROOT, "app", "api", "v1"),
    (filename) => filename === "route.ts",
  );
  const useCaseFiles = await collectFilesRecursively(
    path.join(ROOT, "app", "api", "useCases"),
    (filename) => filename.endsWith(".ts"),
  );
  const repositoryFiles = await collectFilesRecursively(
    path.join(ROOT, "app", "api", "infra", "data", "repositories"),
    (filename) => filename.endsWith(".ts"),
  );

  const currentRouteViolations = new Set<string>();
  const currentUseCaseViolations = new Set<string>();
  const currentRepositoryViolations = new Set<string>();

  for (const routeFile of routeFiles) {
    const relative = normalizeRelativePath(routeFile);
    const fileContent = await fs.readFile(routeFile, "utf8");
    if (!containsHttpRequestCall(fileContent)) {
      continue;
    }

    currentRouteViolations.add(relative);
    if (!routeAllowlist.has(relative)) {
      issues.push(
        `Route com requisição HTTP externa detectada: ${relative}. Apenas Service pode realizar requisições HTTP.`,
      );
    }
  }

  for (const useCaseFile of useCaseFiles) {
    const relative = normalizeRelativePath(useCaseFile);
    const fileContent = await fs.readFile(useCaseFile, "utf8");
    if (!containsHttpRequestCall(fileContent)) {
      continue;
    }

    currentUseCaseViolations.add(relative);
    if (!useCaseAllowlist.has(relative)) {
      issues.push(
        `UseCase com requisição HTTP externa detectada: ${relative}. Apenas Service pode realizar requisições HTTP.`,
      );
    }
  }

  for (const repositoryFile of repositoryFiles) {
    const relative = normalizeRelativePath(repositoryFile);
    const fileContent = await fs.readFile(repositoryFile, "utf8");
    if (!containsHttpRequestCall(fileContent)) {
      continue;
    }

    currentRepositoryViolations.add(relative);
    if (!repositoryAllowlist.has(relative)) {
      issues.push(
        `Repository com requisição HTTP externa detectada: ${relative}. Apenas Service pode realizar requisições HTTP.`,
      );
    }
  }

  for (const allowlistedPath of routeAllowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (routeHttpRequestAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentRouteViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (Route no longer performs HTTP request): ${allowlistedPath}`,
      );
    }
  }

  for (const allowlistedPath of useCaseAllowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (useCaseHttpRequestAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentUseCaseViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (UseCase no longer performs HTTP request): ${allowlistedPath}`,
      );
    }
  }

  for (const allowlistedPath of repositoryAllowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (repositoryHttpRequestAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentRepositoryViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (Repository no longer performs HTTP request): ${allowlistedPath}`,
      );
    }
  }
}

async function validateNonRepositoryDatabaseAccess(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const allowlist = normalizePathList(
    config.legacyExceptions.nonRepositoryDatabaseAccessAllowlist,
  );

  const apiFiles = await collectFilesRecursively(
    path.join(ROOT, "app", "api"),
    (filename) => filename.endsWith(".ts"),
  );

  const currentViolations = new Set<string>();

  for (const apiFile of apiFiles) {
    const relative = normalizeRelativePath(apiFile);

    if (relative.startsWith("app/api/infra/data/repositories/")) {
      continue;
    }

    // Reaproveita validação específica já existente para routes em /api/v1.
    if (relative.startsWith("app/api/v1/")) {
      continue;
    }

    if (relative === "app/api/infra/data/prisma.ts") {
      continue;
    }

    const fileContent = await fs.readFile(apiFile, "utf8");
    if (!containsPrismaDataAccess(fileContent)) {
      continue;
    }

    currentViolations.add(relative);
    if (!allowlist.has(relative)) {
      issues.push(
        `Acesso ao banco fora da camada Repository detectado: ${relative}. Somente Repository deve executar queries Prisma.`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (nonRepositoryDatabaseAccessAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (non-repository DB access no longer detected): ${allowlistedPath}`,
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
  const appRoot = path.join(ROOT, "app");
  const allowlist = normalizePathList(
    config.legacyExceptions.frontendFeatureStructureAllowlist,
  );

  if (!(await pathExists(appRoot))) {
    return;
  }

  const pageFiles = await collectFilesRecursively(
    appRoot,
    (filename) => filename === "page.tsx",
  );

  for (const pageFile of pageFiles) {
    const pageDirectory = path.dirname(pageFile);
    const relativePagePath = normalizeRelativePath(pageDirectory);
    if (allowlist.has(relativePagePath)) {
      continue;
    }

    const missing: string[] = [];
    const availableDirectories = new Set<string>();
    for (const directorySegments of FRONTEND_REQUIRED_DIRECTORIES) {
      const requiredDirectory = path.join(pageDirectory, ...directorySegments);
      const directoryExists = await isDirectory(requiredDirectory);
      if (!directoryExists) {
        missing.push(normalizeRelativePath(requiredDirectory));
        continue;
      }

      availableDirectories.add(directorySegments.join("/"));
    }

    for (const requiredFileName of FRONTEND_REQUIRED_FILES) {
      const requiredFile = path.join(pageDirectory, requiredFileName);
      if (!(await pathExists(requiredFile))) {
        missing.push(normalizeRelativePath(requiredFile));
      }
    }

    for (const requirement of FRONTEND_PATTERN_REQUIREMENTS) {
      const directoryKey = requirement.directorySegments.join("/");
      if (!availableDirectories.has(directoryKey)) {
        continue;
      }

      const requiredDirectory = path.join(
        pageDirectory,
        ...requirement.directorySegments,
      );
      if (
        !(await directoryHasMatchingFile(requiredDirectory, requirement.matcher))
      ) {
        missing.push(path.posix.join(relativePagePath, requirement.label));
      }
    }

    if (missing.length > 0) {
      issues.push(
        `Frontend page architecture violation in ${relativePagePath}. Missing: ${missing.join(", ")}`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      warnings.push(
        `Legacy frontend allowlist path not found: ${allowlistedPath}`,
      );
      continue;
    }

    const allowlistedPagePath = path.join(absolutePath, "page.tsx");
    if (!(await pathExists(allowlistedPagePath))) {
      warnings.push(
        `Legacy frontend allowlist path has no page.tsx: ${allowlistedPath}`,
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

async function validateBrowserNativeDialogs(issues: string[]): Promise<void> {
  const sourceFiles = await collectFrontendSourceFiles();

  for (const sourceFile of sourceFiles) {
    const relative = normalizeRelativePath(sourceFile);
    const content = await fs.readFile(sourceFile, "utf8");
    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const trimmed = line.trim();

      // Ignore comment-only lines to reduce false positives.
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
      ) {
        continue;
      }

      const windowMatch = line.match(WINDOW_BROWSER_DIALOG_REGEX);
      if (windowMatch) {
        issues.push(
          `Uso proibido de diálogo nativo do browser: ${relative}:${
            index + 1
          } (${windowMatch[1]}). Use shadcn AlertDialog/Dialog e sonner.`,
        );
        continue;
      }

      const globalMatch = line.match(GLOBAL_BROWSER_DIALOG_REGEX);
      if (globalMatch) {
        issues.push(
          `Uso proibido de diálogo nativo do browser: ${relative}:${
            index + 1
          } (${globalMatch[2]}). Use shadcn AlertDialog/Dialog e sonner.`,
        );
      }
    }
  }
}

function isClientApiMaskingExcludedPath(relativePath: string): boolean {
  return CLIENT_API_MASKING_EXCLUDED_PATH_PREFIXES.some((prefix) =>
    relativePath.startsWith(prefix),
  );
}

function isServerOnlySource(fileContent: string): boolean {
  return SERVER_ONLY_MODULE_REGEX.test(fileContent);
}

function lineHardcodesClientApiV1Path(line: string): boolean {
  const trimmed = line.trim();
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*")
  ) {
    return false;
  }

  // Type/value imports from app/api/v1 modules are allowed (not Network URLs).
  if (API_V1_MODULE_IMPORT_REGEX.test(line)) {
    return false;
  }

  return HARDCODED_API_V1_PATH_REGEX.test(line);
}

async function collectClientApiMaskingSourceFiles(): Promise<string[]> {
  const found = new Set<string>();

  for (const rootDirectory of CLIENT_API_MASKING_SCAN_DIRECTORIES) {
    const absoluteRoot = path.join(ROOT, rootDirectory);
    const files = await collectFilesRecursively(
      absoluteRoot,
      (filename, absolutePath) => {
        const extension = path.extname(absolutePath).toLowerCase();
        if (!FRONTEND_SOURCE_EXTENSIONS.has(extension)) {
          return false;
        }
        if (filename.endsWith(".test.ts") || filename.endsWith(".test.tsx")) {
          return false;
        }
        const relative = normalizeRelativePath(absolutePath);
        return !isClientApiMaskingExcludedPath(relative);
      },
    );

    for (const file of files) {
      found.add(file);
    }
  }

  return Array.from(found).sort((a, b) => a.localeCompare(b));
}

/**
 * Ensures client-side HTTP calls do not expose `/api/v1/...` in the browser
 * Network tab. New code MUST use `API_CLIENT_BASE` from `@/lib/route-map`
 * (rewritten by proxy to `/api/v1`). Legacy paths may be allowlisted.
 */
async function validateClientApiPathMasking(
  config: GovernanceConfig,
  issues: string[],
  warnings: string[],
): Promise<void> {
  const allowlist = normalizePathList(
    config.legacyExceptions.clientApiPathMaskingAllowlist,
  );
  const sourceFiles = await collectClientApiMaskingSourceFiles();
  const currentViolations = new Set<string>();

  for (const sourceFile of sourceFiles) {
    const relative = normalizeRelativePath(sourceFile);
    const content = await fs.readFile(sourceFile, "utf8");

    if (isServerOnlySource(content)) {
      continue;
    }

    const lines = content.split(/\r?\n/);
    const offendingLines: number[] = [];

    for (let index = 0; index < lines.length; index++) {
      if (lineHardcodesClientApiV1Path(lines[index])) {
        offendingLines.push(index + 1);
      }
    }

    if (offendingLines.length === 0) {
      continue;
    }

    currentViolations.add(relative);
    if (!allowlist.has(relative)) {
      const preview = offendingLines.slice(0, 3).join(", ");
      const more =
        offendingLines.length > 3 ? ` (+${offendingLines.length - 3} more)` : "";
      issues.push(
        `Client API path masking violation: ${relative} (lines ${preview}${more}). Use \`API_CLIENT_BASE\` from \`@/lib/route-map\` instead of hardcoding \`/api/v1/...\`, or add a justified LEGACY EXCEPTION in clientApiPathMaskingAllowlist.`,
      );
    }
  }

  for (const allowlistedPath of allowlist) {
    const absolutePath = toAbsolutePath(allowlistedPath);
    if (!(await pathExists(absolutePath))) {
      issues.push(
        `Legacy exception path does not exist (clientApiPathMaskingAllowlist): ${allowlistedPath}`,
      );
      continue;
    }

    if (!currentViolations.has(allowlistedPath)) {
      warnings.push(
        `Legacy exception may be removable (no hardcoded /api/v1 path detected): ${allowlistedPath}`,
      );
    }
  }
}

const BUN_GLOBAL_SCAN_DIRECTORIES = ["app", "lib"];
const BUN_GLOBAL_REGEX = /(?<![\w.$])Bun\s*\./;

async function validateBunGlobalUsage(issues: string[]): Promise<void> {
  for (const rootDirectory of BUN_GLOBAL_SCAN_DIRECTORIES) {
    const absoluteRoot = path.join(ROOT, rootDirectory);
    const files = await collectFilesRecursively(
      absoluteRoot,
      (filename, absolutePath) => {
        const extension = path.extname(absolutePath).toLowerCase();
        if (extension !== ".ts" && extension !== ".tsx") {
          return false;
        }
        return !filename.endsWith(".test.ts") && !filename.endsWith(".test.tsx");
      },
    );

    for (const sourceFile of files) {
      const relative = normalizeRelativePath(sourceFile);
      const content = await fs.readFile(sourceFile, "utf8");
      const lines = content.split(/\r?\n/);

      for (let index = 0; index < lines.length; index++) {
        const trimmed = lines[index].trim();
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*")
        ) {
          continue;
        }

        if (BUN_GLOBAL_REGEX.test(lines[index])) {
          issues.push(
            `Uso proibido do global Bun em código de runtime: ${relative}:${
              index + 1
            }. Produção roda em Node (Vercel) — use APIs portáveis (ex.: bcryptjs, node:crypto).`,
          );
        }
      }
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

function getWarnAllowlistExclusions(
  config: GovernanceConfig,
  monitoringConfig: AllowlistMonitoringConfig,
): { exclusionsByCategory: Map<string, Set<string>>; warnings: string[] } {
  const warnings: string[] = [];
  const exclusionsByCategory = new Map<string, Set<string>>();
  const configuredExclusions = monitoringConfig.excludeFromWarnAllowlist ?? {};
  const knownCategories = new Set(Object.keys(config.legacyExceptions));

  for (const [category, entries] of Object.entries(configuredExclusions)) {
    if (!Array.isArray(entries)) {
      warnings.push(
        `Monitor config category must be an array (excludeFromWarnAllowlist.${category}).`,
      );
      continue;
    }

    if (!knownCategories.has(category)) {
      warnings.push(
        `Monitor config references unknown allowlist category: ${category}.`,
      );
      continue;
    }

    const normalizedEntries = normalizePathList(entries);
    const legacyEntriesForCategory = normalizePathList(
      config.legacyExceptions[category],
    );

    for (const entry of normalizedEntries) {
      if (!legacyEntriesForCategory.has(entry)) {
        warnings.push(
          `Monitor config path not found in legacy allowlist category ${category}: ${entry}.`,
        );
      }
    }

    exclusionsByCategory.set(category, normalizedEntries);
  }

  return { exclusionsByCategory, warnings };
}

function printAllowlistWarnings(
  config: GovernanceConfig,
  monitoringConfig: AllowlistMonitoringConfig,
): void {
  const { exclusionsByCategory, warnings: monitorWarnings } =
    getWarnAllowlistExclusions(config, monitoringConfig);
  for (const warning of monitorWarnings) {
    console.warn(`::warning title=Governance Allowlist Monitor::${warning}`);
  }

  const entries = getLegacyExceptionEntries(config)
    .map(([category, paths]) => {
      const exclusions = exclusionsByCategory.get(category);
      if (!exclusions || exclusions.size === 0) {
        return [category, paths] as [string, string[]];
      }
      const filtered = paths.filter(
        (entry) => !exclusions.has(entry.replaceAll("\\", "/")),
      );
      return [category, filtered] as [string, string[]];
    })
    .filter(([, paths]) => paths.length > 0);

  if (entries.length === 0) {
    return;
  }

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

function tableHasCreateStatement(sql: string, table: string): boolean {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Somente o identificador alvo do CREATE TABLE (não menções em FK/ALTER posteriores).
  const createTarget = new RegExp(
    `\\bCREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:(?:public|"public")\\.)?"?${escaped}"?\\s*\\(`,
    "i",
  )
  if (createTarget.test(sql)) {
    return true
  }

  const renamePattern = new RegExp(`RENAME\\s+TO\\s+"?${escaped}"?\\b`, "i")
  if (renamePattern.test(sql)) {
    return true
  }

  if (
    table.startsWith("corretor_studio_radar_") &&
    /corretor_studio_radar_%s/.test(sql) &&
    /\bRENAME\s+TO\b/i.test(sql)
  ) {
    return true
  }

  return false
}

async function validatePrismaModelTableMigrations(issues: string[]): Promise<void> {
  const schemaPath = path.join(ROOT, "prisma/schema.prisma");
  const migrationsDir = path.join(ROOT, "supabase/migrations");
  const schema = await fs.readFile(schemaPath, "utf8");
  const migrationFiles = (await fs.readdir(migrationsDir)).filter((file) =>
    file.endsWith(".sql"),
  );
  const migrationContents = await Promise.all(
    migrationFiles.map((file) =>
      fs.readFile(path.join(migrationsDir, file), "utf8"),
    ),
  );

  const modelBlocks = schema.split(/^model /m).slice(1);
  const missing: string[] = [];

  for (const block of modelBlocks) {
    const mapMatch = block.match(/@@map\("([^"]+)"\)/);
    if (!mapMatch) continue;
    const table = mapMatch[1];
    const found = migrationContents.some((sql) => tableHasCreateStatement(sql, table));
    if (!found) {
      missing.push(table);
    }
  }

  if (missing.length > 0) {
    const preview = missing.slice(0, 10).join(", ");
    const suffix = missing.length > 10 ? ` (+${missing.length - 10} more)` : "";
    issues.push(
      `Prisma @@map table(s) without CREATE TABLE in supabase/migrations: ${preview}${suffix}`,
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
  const frozenAllowlists = await loadFrozenAllowlistsConfig();

  validateCanonicalMetadata(config, canonicalText, issues);
  validateFrozenAllowlistsNoNewItems(config, frozenAllowlists, issues);
  await validateAdapters(config, canonicalText, canonicalAbsolutePath, issues);
  await validatePrismaInV1Routes(config, issues, warnings);
  await validateNoPrismaInUseCase(config, issues, warnings);
  await validatePrismaIncludeUsage(config, issues, warnings);
  await validateRouteRepositoryImports(config, issues, warnings);
  await validateServiceImportsOutsideUseCases(config, issues, warnings);
  await validateHttpRequestBoundaries(config, issues, warnings);
  await validateNonRepositoryDatabaseAccess(config, issues, warnings);
  await validateUseCaseOutputContract(config, issues, warnings);
  await validateFrontendFeatureStructure(config, issues, warnings);
  await validateNonTypeScriptFiles(config, issues, warnings);
  await validateClientApiPathMasking(config, issues, warnings);
  await validateBrowserNativeDialogs(issues);
  await validateBunGlobalUsage(issues);
  await validatePrismaModelTableMigrations(issues);
  await validateE2ePageCoverage(issues, warnings);

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

async function checkClientApiPathMaskingOnly(
  config: GovernanceConfig,
): Promise<void> {
  const issues: string[] = [];
  const warnings: string[] = [];

  await validateClientApiPathMasking(config, issues, warnings);

  if (warnings.length > 0) {
    console.warn("\n[governance:check-api-masking] WARNINGS");
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (issues.length > 0) {
    console.error("\n[governance:check-api-masking] FAILED");
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    process.exit(1);
  }

  console.info("[governance:check-api-masking] OK");
}

async function checkE2ePagesOnly(): Promise<void> {
  const issues: string[] = [];
  const warnings: string[] = [];

  await validateE2ePageCoverage(issues, warnings);

  if (warnings.length > 0) {
    console.warn("\n[governance:check-e2e-pages] WARNINGS");
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  if (issues.length > 0) {
    console.error("\n[governance:check-e2e-pages] FAILED");
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    process.exit(1);
  }

  console.info("[governance:check-e2e-pages] OK");
}

async function main(): Promise<void> {
  const validCommands = new Set<Command>([
    "check",
    "check-api-masking",
    "check-e2e-pages",
    "sync-adapters",
    "warn-allowlist",
  ]);
  const maybeCommand = (process.argv[2] ?? "check") as Command;

  if (!validCommands.has(maybeCommand)) {
    console.error("Unknown command:", maybeCommand);
    console.error(
      "Usage: bun scripts/ai-governance.ts [check|check-api-masking|check-e2e-pages|sync-adapters|warn-allowlist]",
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
    const monitoringConfig = await loadAllowlistMonitoringConfig();
    printAllowlistWarnings(config, monitoringConfig);
    return;
  }

  if (maybeCommand === "check-api-masking") {
    await checkClientApiPathMaskingOnly(config);
    return;
  }

  if (maybeCommand === "check-e2e-pages") {
    await checkE2ePagesOnly();
    return;
  }

  await checkGovernance(config, canonicalText, canonicalPath);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error("[governance] Fatal error:", error);
    process.exit(1);
  });
}
