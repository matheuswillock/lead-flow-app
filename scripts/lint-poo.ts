#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";

export type PooRuleCode =
  | "POO001"
  | "POO002"
  | "POO003"
  | "POO004"
  | "POO005"
  | "POO006"
  | "POO007"
  | "POO008";

export interface PooViolation {
  code: PooRuleCode;
  file: string;
  line: number;
  message: string;
  recommendation: string;
}

export interface LegacyEvaluation {
  errors: string[];
  warnings: string[];
}

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, ".governance", "ai-governance.config.json");
const SOURCE_ROOTS = ["app", "lib"];
const MAX_INTERFACE_MEMBERS = 12;
const PROVIDER_TOKENS = [
  "abacate",
  "asaas",
  "groq",
  "mercadopago",
  "openwa",
  "pagarme",
  "paypal",
  "resend",
  "stripe",
  "twilio",
  "vercel",
  "whatsapp",
];

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

function hasProviderToken(value: string): boolean {
  const normalized = value.toLowerCase();
  return PROVIDER_TOKENS.some((token) => normalized.includes(token));
}

function isExternalProviderReference(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    PROVIDER_TOKENS.filter((token) => token !== "whatsapp").some((token) => normalized.includes(token)) ||
    normalized.includes("openwa") ||
    normalized.includes("whatsapp/provider") ||
    normalized.includes("whatsapp-sdk")
  );
}

function isExcluded(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return (
    normalized.includes("/node_modules/") ||
    normalized.includes("/.next/") ||
    normalized.includes("/e2e/") ||
    normalized.includes("/fixtures/") ||
    normalized.includes("/__tests__/") ||
    normalized.endsWith(".d.ts") ||
    /(?:^|\/)[^/]+\.(?:test|spec)\.[^.]+$/.test(normalized) ||
    normalized.includes("/generated/")
  );
}

function isAdapterFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return [
    "/infra/gateways/",
    "/infra/providers/",
    "/infra/paymentProviders/",
    "/paymentProviders/",
    "/services/whatsapp/provider/",
    "/services/backofficeBot/ai/",
    "/lib/asaas/",
  ].some((segment) => normalized.includes(segment));
}

function isBoundaryFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return (
    normalized.startsWith("app/api/useCases/") ||
    normalized.startsWith("app/api/services/") ||
    normalized.includes("/domain/") ||
    normalized.startsWith("lib/")
  );
}

function isProviderClassName(name: string): boolean {
  return (
    /(Provider|Gateway|Client)$/.test(name) &&
    (hasProviderToken(name) || /(Provider|Gateway)$/.test(name))
  );
}

function nodeLine(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function violation(
  code: PooRuleCode,
  file: string,
  line: number,
  message: string,
  recommendation: string,
): PooViolation {
  return { code, file: normalizePath(file), line, message, recommendation };
}

function importBindingsContainProvider(importDeclaration: ts.ImportDeclaration): boolean {
  const clause = importDeclaration.importClause;
  if (!clause) return false;
  const names: string[] = [];
  if (clause.name) names.push(clause.name.text);
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) {
    names.push(...bindings.elements.map((element) => (element.name ?? element.propertyName).text));
  }
  return names.some((name) => isExternalProviderReference(name) && !/^I[A-Z]/.test(name));
}

function importIsExternalPayload(importDeclaration: ts.ImportDeclaration): boolean {
  const clause = importDeclaration.importClause;
  const moduleName = importDeclaration.moduleSpecifier.getText().replaceAll('"', "").replaceAll("'", "");
  const names: string[] = [];
  if (clause?.isTypeOnly) names.push("type");
  if (clause?.name) names.push(clause.name.text);
  if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    for (const element of clause.namedBindings.elements) {
      if (element.isTypeOnly) names.push("type");
      names.push(element.name.text, element.propertyName?.text ?? "");
    }
  }
  return (
    isExternalProviderReference(moduleName) &&
    (names.some((name) => /(?:payload|request|response|dto|event|error|type)/i.test(name)) ||
      moduleName.includes("sdk") ||
      moduleName.includes("types"))
  );
}

function checkImportBoundary(
  sourceFile: ts.SourceFile,
  filePath: string,
  node: ts.ImportDeclaration,
): PooViolation | null {
  if (!isBoundaryFile(filePath) || isAdapterFile(filePath)) return null;

  const moduleName = node.moduleSpecifier.getText().replaceAll('"', "").replaceAll("'", "");
  const providerImport = isExternalProviderReference(moduleName) || importBindingsContainProvider(node);
  if (!providerImport) return null;

  if (importIsExternalPayload(node)) {
    return violation(
      "POO004",
      filePath,
      nodeLine(sourceFile, node),
      "Tipo ou payload externo de provider atravessa a fronteira do domínio.",
      "Traduza o tipo externo dentro do adapter e exponha um modelo interno pela interface.",
    );
  }

  return violation(
    "POO001",
    filePath,
    nodeLine(sourceFile, node),
    "SDK, cliente ou dependência concreta de provider foi importado por uma camada de domínio.",
    "Mova a dependência para um adapter de infraestrutura e injete uma porta orientada a capacidade.",
  );
}

function collectClassViolations(
  sourceFile: ts.SourceFile,
  filePath: string,
  node: ts.ClassDeclaration,
): PooViolation[] {
  const findings: PooViolation[] = [];
  const className = node.name?.text ?? "classe sem nome";
  const classText = node.getText(sourceFile);
  const hasContract = (node.heritageClauses ?? []).some(
    (clause) =>
      clause.types.length > 0 &&
      (clause.token === ts.SyntaxKind.ImplementsKeyword || clause.token === ts.SyntaxKind.ExtendsKeyword),
  );

  if ((isAdapterFile(filePath) || hasProviderToken(className)) && isProviderClassName(className) && !hasContract) {
    findings.push(
      violation(
        "POO003",
        filePath,
        nodeLine(sourceFile, node),
        `O adapter ${className} não declara um contrato ou capacidade implementada.`,
        "Declare uma interface de capacidade e implemente-a no adapter concreto.",
      ),
    );
  }

  const isProviderOrDomainClass =
    ((isAdapterFile(filePath) || hasProviderToken(className)) && isProviderClassName(className)) ||
    normalizePath(filePath).includes("/domain/");
  if (isProviderOrDomainClass) {
    for (const member of node.members) {
      if (ts.isPropertyDeclaration(member)) {
        const modifiers = ts.getModifiers(member) ?? [];
        const encapsulated = modifiers.some((modifier) =>
          [
            ts.SyntaxKind.PrivateKeyword,
            ts.SyntaxKind.ProtectedKeyword,
            ts.SyntaxKind.ReadonlyKeyword,
            ts.SyntaxKind.StaticKeyword,
          ].includes(modifier.kind),
        );
        if (!encapsulated) {
          findings.push(
            violation(
              "POO005",
              filePath,
              nodeLine(sourceFile, member),
              `A propriedade ${member.name.getText(sourceFile)} é pública e mutável em ${className}.`,
              "Encapsule o estado como private/protected ou torne a propriedade readonly.",
            ),
          );
        }
      }
      if (ts.isConstructorDeclaration(member)) {
        for (const parameter of member.parameters) {
          const modifiers = ts.getModifiers(parameter) ?? [];
          const isParameterProperty = modifiers.some((modifier) =>
            [
              ts.SyntaxKind.PublicKeyword,
              ts.SyntaxKind.PrivateKeyword,
              ts.SyntaxKind.ProtectedKeyword,
              ts.SyntaxKind.ReadonlyKeyword,
            ].includes(modifier.kind),
          );
          const encapsulated = modifiers.some((modifier) =>
            [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(modifier.kind),
          );
          if (isParameterProperty && !encapsulated) {
            findings.push(
              violation(
                "POO005",
                filePath,
                nodeLine(sourceFile, parameter),
                "A propriedade criada pelo construtor é pública e mutável.",
                "Use private, protected ou readonly na propriedade injetada.",
              ),
            );
          }
        }
      }
    }
  }

  const isBaseClass = /^(Base|Abstract)/.test(className) || node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AbstractKeyword);
  if (isBaseClass && hasProviderToken(classText)) {
    findings.push(
      violation(
        "POO006",
        filePath,
        nodeLine(sourceFile, node),
        `A classe-base ${className} contém comportamento específico de provider.`,
        "Mantenha a classe-base agnóstica e mova a variação para uma estratégia ou adapter.",
      ),
    );
  }

  return findings;
}

export function scanSource(filePath: string, source: string): PooViolation[] {
  const normalizedFile = normalizePath(filePath);
  if (isExcluded(normalizedFile)) return [];

  const sourceFile = ts.createSourceFile(
    normalizedFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    normalizedFile.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings: PooViolation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const importFinding = checkImportBoundary(sourceFile, normalizedFile, node);
      if (importFinding) findings.push(importFinding);
    }

    if (ts.isNewExpression(node) && isBoundaryFile(normalizedFile) && !isAdapterFile(normalizedFile)) {
      const expressionName = node.expression.getText(sourceFile);
      if (isProviderClassName(expressionName)) {
        findings.push(
          violation(
            "POO002",
            normalizedFile,
            nodeLine(sourceFile, node),
            `A implementação concreta ${expressionName} é instanciada fora da infraestrutura.`,
            "Injete a porta e deixe a factory, router ou registry selecionar o adapter.",
          ),
        );
      }
    }

    if (ts.isClassDeclaration(node)) findings.push(...collectClassViolations(sourceFile, normalizedFile, node));

    if (ts.isInterfaceDeclaration(node) && (normalizedFile.startsWith("app/api/") || normalizedFile.startsWith("lib/"))) {
      const interfaceIsCapability =
        /^I[A-Z]/.test(node.name.text) ||
        /(Provider|Gateway|Service|Repository|Strategy|Factory|Port|Adapter)$/.test(node.name.text);
      if (interfaceIsCapability && node.members.length > MAX_INTERFACE_MEMBERS) {
      findings.push(
        violation(
          "POO007",
          normalizedFile,
          nodeLine(sourceFile, node),
          `A interface ${node.name.text} mistura ${node.members.length} membros e excede o limite de capacidade coesa.`,
          "Divida o contrato em interfaces menores, uma por capacidade substituível.",
        ),
      );
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const importsConcreteProvider = findings.some((finding) => finding.code === "POO001");
  if (importsConcreteProvider && isBoundaryFile(normalizedFile) && !/Factory|Router|Registry/.test(path.basename(normalizedFile))) {
    const sourceLine = findings.find((finding) => finding.code === "POO001")?.line ?? 1;
    findings.push(
      violation(
        "POO008",
        normalizedFile,
        sourceLine,
        "Uma camada genérica utiliza provider concreto sem uma seleção explícita.",
        "Centralize a escolha em factory, router ou registry e injete somente a capacidade.",
      ),
    );
  }

  return findings.sort((left, right) =>
    `${left.file}:${left.line}:${left.code}`.localeCompare(`${right.file}:${right.line}:${right.code}`),
  );
}

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(absolutePath)));
    } else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }
  return files;
}

export async function scanProject(root = ROOT): Promise<PooViolation[]> {
  const findings: PooViolation[] = [];
  for (const sourceRoot of SOURCE_ROOTS) {
    const directory = path.join(root, sourceRoot);
    try {
      const files = await listSourceFiles(directory);
      for (const filePath of files) {
        const relativePath = normalizePath(path.relative(root, filePath));
        if (isExcluded(relativePath)) continue;
        findings.push(...scanSource(relativePath, await fs.readFile(filePath, "utf8")));
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return findings.sort((left, right) =>
    `${left.file}:${left.line}:${left.code}`.localeCompare(`${right.file}:${right.line}:${right.code}`),
  );
}

function gitNames(args: string[]): Set<string> {
  try {
    const output = execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
    return new Set(output.split(/\r?\n/).map(normalizePath).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function getChangedFiles(): Set<string> {
  const changed = new Set<string>();
  const baseRef = process.env.POO_BASE_REF ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : undefined);
  const diffArgs = baseRef ? ["diff", "--name-only", `${baseRef}...HEAD`] : ["diff", "--name-only", "HEAD"];
  for (const file of gitNames(diffArgs)) changed.add(file);
  for (const file of gitNames(["diff", "--name-only", "--cached"])) changed.add(file);
  for (const file of gitNames(["diff", "--name-only"])) changed.add(file);
  for (const file of gitNames(["ls-files", "--others", "--exclude-standard"])) changed.add(file);
  return changed;
}

export function evaluateLegacyExceptions(
  findings: PooViolation[],
  allowlist: string[],
  changedFiles: Set<string>,
  missingAllowlistPaths: string[] = [],
): LegacyEvaluation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedAllowlist = new Set(allowlist.map(normalizePath));
  const findingsByFile = new Map<string, PooViolation[]>();
  for (const missingPath of missingAllowlistPaths) {
    errors.push("POO allowlist aponta para arquivo inexistente: " + normalizePath(missingPath));
  }
  for (const finding of findings) {
    const current = findingsByFile.get(finding.file) ?? [];
    current.push(finding);
    findingsByFile.set(finding.file, current);
  }

  for (const allowlistedPath of normalizedAllowlist) {
    if (!findingsByFile.has(allowlistedPath)) {
      warnings.push("POO allowlist pode ser removida: " + allowlistedPath);
      continue;
    }
    if (changedFiles.has(allowlistedPath)) {
      errors.push("Arquivo legado alterado ainda possui violações POO e perdeu a tolerância: " + allowlistedPath);
    } else {
      warnings.push("Arquivo legado inalterado tolerado pela POO allowlist: " + allowlistedPath);
    }
  }

  for (const [file, fileFindings] of findingsByFile) {
    if (normalizedAllowlist.has(file) && !changedFiles.has(file)) continue;
    for (const finding of fileFindings) {
      errors.push(
        finding.code + " " + finding.file + ":" + finding.line + " — " + finding.message + " Recomenda-se: " + finding.recommendation,
      );
    }
  }
  return { errors, warnings };
}

async function loadAllowlist(): Promise<string[]> {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8")) as {
    legacyExceptions?: { pooLegacyExceptionAllowlist?: string[] };
  };
  return config.legacyExceptions?.pooLegacyExceptionAllowlist ?? [];
}

export async function run(): Promise<number> {
  const findings = await scanProject();
  const allowlist = await loadAllowlist();
  const missingAllowlistPaths: string[] = [];
  for (const allowlistedPath of allowlist) {
    try {
      await fs.access(path.join(ROOT, allowlistedPath));
    } catch {
      missingAllowlistPaths.push(allowlistedPath);
    }
  }
  const evaluation = evaluateLegacyExceptions(findings, allowlist, getChangedFiles(), missingAllowlistPaths);
  for (const warning of evaluation.warnings) console.warn("[lint:poo] WARN — " + warning);
  if (evaluation.errors.length > 0) {
    for (const error of evaluation.errors) console.error("[lint:poo] ERRO — " + error);
    return 1;
  }
  console.info("[lint:poo] OK — " + findings.length + " ocorrência(s) analisada(s); fronteiras POO válidas.");
  return 0;
}

if (import.meta.main) process.exit(await run());
