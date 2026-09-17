import {
  AUDIENCE_REASON_BLOCKLISTED,
  AUDIENCE_REASON_BOUNCED,
  AUDIENCE_REASON_DEAD_ISP,
  AUDIENCE_REASON_DISPOSABLE,
  AUDIENCE_REASON_NO_MX,
  AUDIENCE_REASON_ROLE,
  AUDIENCE_REASON_TYPO_DOMAIN,
} from "@/lib/email/audience-prevalidation"

/**
 * Veredito do gate de importação de contatos: contagem de remoções por
 * categoria + classificação de risco. Persistido em
 * `EmailImportJob.validationCounts` / `EmailImportJob.riskLevel` e exibido no
 * relatório de importação.
 *
 * Divisão estável × volátil (mesma invariante do offset posicional do job —
 * ver `EmailContactImportUseCase.collectAudienceValidRows`):
 * - Categorias ESTÁVEIS derivam só do arquivo (puras): recomputadas a cada
 *   claim e ATRIBUÍDAS, nunca somadas.
 * - Categorias VOLÁTEIS derivam de estado externo (blocklist, bounce global,
 *   DNS): apuradas lote a lote e ACUMULADAS entre claims.
 * Os dois conjuntos são disjuntos, então o resume recupera o acumulado
 * volátil lendo só as chaves voláteis do JSON persistido.
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

/** Motivo textual do skip → categoria do veredito. */
export function classifyImportSkipReason(reason: string): ImportRemovalCategory {
  switch (reason) {
    case "E-mail ausente na linha":
    case "E-mail ausente":
      return "emptyLine"
    case AUDIENCE_REASON_TYPO_DOMAIN:
      return "typoDomain"
    case AUDIENCE_REASON_DEAD_ISP:
      return "deadProvider"
    case AUDIENCE_REASON_DISPOSABLE:
      return "disposableDomain"
    case AUDIENCE_REASON_ROLE:
      return "roleAccount"
    case AUDIENCE_REASON_NO_MX:
      return "noMxDomain"
    case AUDIENCE_REASON_BOUNCED:
      return "suppressedBounce"
    case AUDIENCE_REASON_BLOCKLISTED:
      return "suppressedBlocklist"
    case "E-mail contém espaços":
    case "E-mail com múltiplos endereços":
    case "Formato de e-mail inválido":
      return "syntax"
    default:
      return "other"
  }
}

export function addToImportValidationCounts(
  counts: ImportValidationCounts,
  category: ImportRemovalCategory,
  amount = 1
): void {
  if (amount <= 0) return
  counts[category] = (counts[category] ?? 0) + amount
}

export function mergeImportValidationCounts(
  ...groups: ImportValidationCounts[]
): ImportValidationCounts {
  const merged: ImportValidationCounts = {}
  for (const group of groups) {
    for (const [category, count] of Object.entries(group) as Array<
      [ImportRemovalCategory, number | undefined]
    >) {
      addToImportValidationCounts(merged, category, count ?? 0)
    }
  }
  return merged
}

/** Só as chaves voláteis de um JSON persistido — usado no resume do job. */
export function pickVolatileImportValidationCounts(
  value: unknown
): ImportValidationCounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const volatileCounts: ImportValidationCounts = {}
  for (const category of IMPORT_VOLATILE_REMOVAL_CATEGORIES) {
    const count = source[category]
    if (typeof count === "number" && Number.isFinite(count) && count > 0) {
      volatileCounts[category] = count
    }
  }
  return volatileCounts
}

export function sumImportValidationCounts(counts: ImportValidationCounts): number {
  return Object.values(counts).reduce<number>((total, count) => total + (count ?? 0), 0)
}

/**
 * Removidos que CONTAM para o risco: só o que queima reputação ou denuncia
 * lista suja. `duplicate` e `emptyLine` ficam de fora do numerador — linha
 * repetida ou vazia não gera bounce; incluí-las quarentenaria lista limpa
 * apenas redundante. Ambas continuam no veredito EXIBIDO.
 */
export function countRemovalsRelevantForRisk(counts: ImportValidationCounts): number {
  let total = 0
  for (const [category, count] of Object.entries(counts) as Array<
    [ImportRemovalCategory, number | undefined]
  >) {
    if (category === "duplicate" || category === "emptyLine") continue
    total += count ?? 0
  }
  return total
}

export type EmailImportRiskLevelValue = "low" | "medium" | "high"

/** Limiar de risco MÉDIO: fração removida ≥ 8%. */
export const IMPORT_RISK_MEDIUM_MIN_REMOVED_RATIO = 0.08
/** Limiar de risco ALTO: fração removida ≥ 20%… */
export const IMPORT_RISK_HIGH_MIN_REMOVED_RATIO = 0.2
/** …ou volume absoluto removido ≥ 500, mesmo em arquivo gigante. */
export const IMPORT_RISK_HIGH_MIN_REMOVED_ABSOLUTE = 500

export function computeImportRiskLevel(params: {
  removedCount: number
  totalRows: number
}): EmailImportRiskLevelValue {
  const { removedCount, totalRows } = params
  if (removedCount >= IMPORT_RISK_HIGH_MIN_REMOVED_ABSOLUTE) return "high"
  if (totalRows <= 0) return "low"

  const removedRatio = removedCount / totalRows
  if (removedRatio >= IMPORT_RISK_HIGH_MIN_REMOVED_RATIO) return "high"
  if (removedRatio >= IMPORT_RISK_MEDIUM_MIN_REMOVED_RATIO) return "medium"
  return "low"
}

export const IMPORT_RISK_LEVEL_LABELS: Record<EmailImportRiskLevelValue, string> = {
  low: "BAIXO",
  medium: "MÉDIO",
  high: "ALTO",
}

/**
 * Resumo humano do veredito, na ordem canônica das categorias — usado na
 * notificação de conclusão e no relatório. Ex.:
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
