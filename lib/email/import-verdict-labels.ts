/**
 * Rótulos e formatação do veredito de importação — módulo CLIENT-SAFE, sem
 * dependências: o classificador (`import-validation-verdict.ts`) puxa a
 * pré-validação de audiência, que embarca a lista de ~8,9 mil domínios
 * descartáveis; a UI só precisa destes rótulos e não deve pagar esse bundle.
 */

export const IMPORT_STABLE_REMOVAL_CATEGORIES = [
  "emptyLine",
  "syntax",
  "typoDomain",
  "deadProvider",
  "disposableDomain",
  "roleAccount",
  "duplicate",
  "other",
] as const

export const IMPORT_VOLATILE_REMOVAL_CATEGORIES = [
  "noMxDomain",
  "suppressedBounce",
  "suppressedBlocklist",
] as const

export type ImportStableRemovalCategory = (typeof IMPORT_STABLE_REMOVAL_CATEGORIES)[number]
export type ImportVolatileRemovalCategory = (typeof IMPORT_VOLATILE_REMOVAL_CATEGORIES)[number]
export type ImportRemovalCategory = ImportStableRemovalCategory | ImportVolatileRemovalCategory

export type ImportValidationCounts = Partial<Record<ImportRemovalCategory, number>>

export const IMPORT_REMOVAL_CATEGORY_LABELS: Record<ImportRemovalCategory, string> = {
  emptyLine: "linha sem e-mail",
  syntax: "sintaxe inválida",
  typoDomain: "typo de domínio",
  deadProvider: "provedor desativado",
  disposableDomain: "descartáveis",
  roleAccount: "endereço genérico",
  duplicate: "duplicados",
  other: "outros",
  noMxDomain: "sem MX",
  suppressedBounce: "supressão (bounce)",
  suppressedBlocklist: "supressão (blocklist)",
}

export type EmailImportRiskLevelValue = "low" | "medium" | "high"

export const IMPORT_RISK_LEVEL_LABELS: Record<EmailImportRiskLevelValue, string> = {
  low: "BAIXO",
  medium: "MÉDIO",
  high: "ALTO",
}

export function sumImportValidationCounts(counts: ImportValidationCounts): number {
  return Object.values(counts).reduce<number>((total, count) => total + (count ?? 0), 0)
}

/**
 * Resumo humano do veredito, na ordem canônica das categorias. Ex.:
 * `87 removidos (43 supressão (bounce), 22 sem MX, 12 descartáveis, 10 duplicados)`.
 */
export function formatImportVerdictSummary(counts: ImportValidationCounts): string {
  const orderedCategories: ImportRemovalCategory[] = [
    ...IMPORT_VOLATILE_REMOVAL_CATEGORIES,
    ...IMPORT_STABLE_REMOVAL_CATEGORIES,
  ]
  const parts: string[] = []
  for (const category of orderedCategories) {
    const count = counts[category] ?? 0
    if (count <= 0) continue
    parts.push(`${count.toLocaleString("pt-BR")} ${IMPORT_REMOVAL_CATEGORY_LABELS[category]}`)
  }
  const removedTotal = sumImportValidationCounts(counts)
  if (removedTotal === 0) return "0 removidos"
  return `${removedTotal.toLocaleString("pt-BR")} removidos (${parts.join(", ")})`
}
