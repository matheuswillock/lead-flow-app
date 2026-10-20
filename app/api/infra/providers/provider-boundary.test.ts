import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises"
import { dirname, join, normalize, relative, resolve, sep } from "node:path"
import * as ts from "typescript"
import { PaymentProviderConfig } from "@/lib/payment-provider/config"
import { AsaasPaymentProvider } from "./AsaasPaymentProvider"
import { AbacatePayProvider } from "./AbacatePayProvider"
import { PaymentProviderBase } from "./PaymentProviderBase"

const forbiddenImports = ["@/lib/asaas", "abacatepay.js", "https://api.abacatepay.com"]

const ASAAS_ENV_KEYS = ["ASAAS_ENV", "ASAAS_URL", "ASAAS_URL_sandbox"] as const

const repositoryRoot = resolve(import.meta.dir, "../../../..")
const sourcePath = (relativePath: string): string => resolve(repositoryRoot, relativePath)
const paymentBoundaryRoots = [sourcePath("app/api/domain"), sourcePath("app/api/useCases/payments")]
const legacyBoundaryException = sourcePath("app/api/useCases/payments/IPaymentValidationUseCase.ts")
const providerTokenPattern =
  /(?:asaas|abacate|providers|payment-provider|brcode|installmentcount|transparents|amountincents|externalreference)/i

async function productionTypeScriptFiles(root: string): Promise<string[]> {
  const relativeRoot = relative(repositoryRoot, root)
  let currentPath = repositoryRoot
  for (const segment of relativeRoot.split(sep).filter(Boolean)) {
    currentPath = join(currentPath, segment)
    if ((await lstat(currentPath)).isSymbolicLink()) {
      throw new Error(`Symlink ancestral não permitido na fronteira: ${currentPath}`)
    }
  }
  const normalizedRepositoryPath = normalize(repositoryRoot)
  const canonicalRoot = normalize(await realpath(root))
  if (
    canonicalRoot !== normalizedRepositoryPath &&
    !canonicalRoot.startsWith(`${normalizedRepositoryPath}/`)
  ) {
    throw new Error(`Fronteira fora do repositório: ${root}`)
  }
  if ((await lstat(root)).isSymbolicLink()) {
    throw new Error(`Symlink não permitido na fronteira: ${root}`)
  }
  const entries = await readdir(root, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = `${root}/${entry.name}`
      if (entry.isSymbolicLink()) {
        throw new Error(`Symlink não permitido na fronteira: ${path}`)
      }
      if ((await stat(path)).isDirectory()) return productionTypeScriptFiles(path)
      return /\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs|json)$/.test(entry.name) ? [path] : []
    }),
  )
  return nestedFiles.flat().sort()
}

async function isProviderSpecifier(specifier: string, importerFile: string): Promise<boolean> {
  const resolvedSpecifier = specifier.startsWith(".")
    ? normalize(resolve(dirname(importerFile), specifier))
    : specifier.startsWith("@/")
      ? normalize(resolve(repositoryRoot, specifier.slice(2)))
      : specifier
  const normalizedRepositoryPath = normalize(repositoryRoot)
  const asaasPath = join(normalizedRepositoryPath, "lib", "asaas")
  const paymentProviderPath = join(normalizedRepositoryPath, "lib", "payment-provider")
  const providerInfraPath = join(normalizedRepositoryPath, "app", "api", "infra", "providers")
  const directMatch = (path: string): boolean =>
    path === "abacatepay.js" ||
    path.startsWith("@/lib/asaas") ||
    path.startsWith("@/lib/payment-provider") ||
    path === asaasPath ||
    path.startsWith(`${asaasPath}${sep}`) ||
    path === paymentProviderPath ||
    path.startsWith(`${paymentProviderPath}${sep}`) ||
    path === providerInfraPath ||
    path.startsWith(`${providerInfraPath}${sep}`)

  if (directMatch(resolvedSpecifier)) return true
  if (!specifier.startsWith(".")) return false

  const candidates = [
    resolvedSpecifier,
    ...[".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"].map(
      (extension) => `${resolvedSpecifier}${extension}`,
    ),
    ...[
      "index.ts",
      "index.tsx",
      "index.js",
      "index.jsx",
      "index.cjs",
      "index.mjs",
      "index.mts",
      "index.cts",
      "index.d.ts",
    ].map((indexFile) => `${resolvedSpecifier}/${indexFile}`),
  ]
  for (const candidate of candidates) {
    try {
      if (directMatch(normalize(await realpath(candidate)))) return true
    } catch {
      // Import resolution may require a bundler alias; lexical checks still apply.
    }
  }
  return false
}

async function hasProviderReference(source: string, importerFile: string): Promise<boolean> {
  const sourceFile = ts.createSourceFile(importerFile, source, ts.ScriptTarget.Latest, true)
  const specifiers: string[] = []
  let hasComputedImport = false

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier
      if (moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier)) {
        specifiers.push(moduleSpecifier.text)
      }
    }
    if (ts.isImportEqualsDeclaration(node)) {
      const moduleReference = node.moduleReference
      if (
        ts.isExternalModuleReference(moduleReference) &&
        moduleReference.expression &&
        ts.isStringLiteralLike(moduleReference.expression)
      ) {
        specifiers.push(moduleReference.expression.text)
      }
    }
    if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const isRequireCall = ts.isIdentifier(node.expression) && node.expression.text === "require"
      if (isDynamicImport || isRequireCall) {
        const argument = node.arguments[0]
        if (!argument || !ts.isStringLiteralLike(argument)) hasComputedImport = true
        else specifiers.push(argument.text)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  if (hasComputedImport) return true
  for (const specifier of specifiers) {
    if (await isProviderSpecifier(specifier, importerFile)) return true
  }

  return (
    /(?:@\/lib\/(?:asaas|payment-provider)|abacatepay\.js)/.test(source) ||
    /https?:\/\//.test(source) ||
    /\b(?:fetch|URL)\s*\(/.test(source) ||
    providerTokenPattern.test(source)
  )
}

function removeExpectedLegacyImports(source: string): string {
  const legacyWebhookImport = [
    "import type { AsaasPayment, AsaasSubscription } from '../../",
    ["services", "PaymentValidation", "AsaasWebhookTypes"].join("/"),
    "';",
  ].join("")
  const expectedLines = new Set([
    'import type { AsaasAccountId } from "@/lib/asaas";',
    legacyWebhookImport,
    "payment: AsaasPayment | AsaasSubscription;",
    "* Conta Asaas que originou o webhook. Achado P1 da revisão do PR #1207",
    "* (thread PRRT_...YP_y): `processAsaasWebhookEvent` já resolve a conta,",
    "account: AsaasAccountId;",
  ])

  return source
    .split("\n")
    .filter((line) => !expectedLines.has(line.trim()))
    .join("\n")
}

describe("payment provider boundary", () => {
  let envSnapshot = new Map<string, string | undefined>()

  beforeEach(() => {
    envSnapshot = new Map(ASAAS_ENV_KEYS.map((key) => [key, process.env[key]]))
    for (const key of ASAAS_ENV_KEYS) delete process.env[key]
  })

  afterEach(() => {
    for (const [key, value] of envSnapshot) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it("keeps provider-specific dependencies out of the domain contracts", async () => {
    const source = await readFile(sourcePath("lib/payment-provider/contracts.ts"), "utf8")
    for (const forbiddenImport of forbiddenImports) expect(source).not.toContain(forbiddenImport)
  })

  it("keeps Asaas on the common provider seam without declaring new capabilities", () => {
    const provider = new AsaasPaymentProvider({} as never)
    expect(provider).toBeInstanceOf(PaymentProviderBase)
    expect(provider.metadata.capabilities).toEqual([])
  })

  it("declares only the one-time Abacate capabilities on the seam", () => {
    const provider = new AbacatePayProvider(
      PaymentProviderConfig.create({
        apiKey: "sk_test",
        publicKey: "pk_test",
        webhookSecret: "secret",
        webhookSigningKey: "hmac",
        environment: "DEV",
        devMode: true,
      }),
    )

    expect(provider.metadata.capabilities).toEqual([
      "PIX",
      "HOSTED_CHECKOUT",
      "CARD",
      "STATUS_QUERY",
      "FULL_REFUND",
      "WEBHOOK",
    ])
    expect(provider.metadata.capabilities).not.toContain("CUSTOMER")
    expect(provider.metadata.capabilities).not.toContain("CATALOG")
  })

  it("keeps the legacy Asaas flows on the migration gateway port", async () => {
    const legacyUseCases = [
      sourcePath("app/api/useCases/asaasAccountMigration/MigrateAsaasAccountUseCase.ts"),
      sourcePath("app/api/useCases/asaasAccountMigration/CardReauthorizationUseCase.ts"),
    ]

    for (const file of legacyUseCases) {
      const source = await readFile(file, "utf8")
      expect(source).toContain("IAsaasMigrationGateway")
      expect(source).not.toContain("AsaasPaymentProvider")
      expect(source).not.toContain("@/lib/payment-provider/contracts")
    }
  })

  it("keeps the Asaas migration gateway implementing the legacy port only", async () => {
    const source = await readFile(
      sourcePath("app/api/infra/gateways/asaasMigration/AsaasMigrationGateway.ts"),
      "utf8",
    )

    expect(source).toContain("implements IAsaasMigrationGateway")
    expect(source).not.toContain("AsaasPaymentProvider")
    expect(source).not.toContain("@/lib/payment-provider/contracts")
  })

  it("keeps domain and payment use cases free of provider details outside explicit Legacy seams", async () => {
    const files = (
      await Promise.all(paymentBoundaryRoots.map((root) => productionTypeScriptFiles(root)))
    ).flat()
    const violations: string[] = []

    for (const file of files) {
      const source = await readFile(file, "utf8")
      const checkedSource =
        file === legacyBoundaryException ? removeExpectedLegacyImports(source) : source
      if (await hasProviderReference(checkedSource, file)) {
        violations.push(file)
      }
    }

    expect(violations).toEqual([])
    expect(files).toContain(legacyBoundaryException)
  })
})
