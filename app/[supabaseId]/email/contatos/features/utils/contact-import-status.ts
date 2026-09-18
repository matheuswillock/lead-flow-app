import type { ContactListActiveImport } from "../context/ContatosTypes"
import {
  formatImportVerdictSummary,
  IMPORT_RISK_LEVEL_LABELS,
  type EmailImportRiskLevelValue,
  type ImportValidationCounts,
} from "@/lib/email/import-verdict-labels"

export type ContactImportStatusView = {
  label: string
  secondaryLabel: string | null
  compact: boolean
  variant: "outline" | "secondary" | "destructive"
}

/**
 * Linha do veredito no relatório de importação, só em job terminal com
 * veredito persistido. Ex.:
 * `1.240 válidos · 87 removidos (43 supressão (bounce), 22 sem MX) · risco: MÉDIO`.
 */
export function resolveImportVerdictLine(
  activeImport: ContactListActiveImport
): string | null {
  const isTerminal =
    activeImport.status === "completed" ||
    activeImport.status === "completed_with_errors"
  if (!isTerminal) return null

  const counts = (activeImport.validationCounts ?? null) as ImportValidationCounts | null
  const riskLevel = (activeImport.riskLevel ?? null) as EmailImportRiskLevelValue | null
  if (!counts && !riskLevel) return null

  const validCount = activeImport.importedCount + activeImport.updatedCount
  const parts = [`${validCount.toLocaleString("pt-BR")} válidos`]
  if (counts) parts.push(formatImportVerdictSummary(counts))
  if (riskLevel && IMPORT_RISK_LEVEL_LABELS[riskLevel]) {
    parts.push(`risco: ${IMPORT_RISK_LEVEL_LABELS[riskLevel]}`)
  }
  return parts.join(" · ")
}

export function resolveContactImportProgressLabel(
  activeImport: ContactListActiveImport
): string {
  if (activeImport.failedRadarSync > 0) {
    return `${activeImport.failedRadarSync} contato(s) com falha no Radar`
  }
  const isTerminal =
    activeImport.status === "completed" ||
    activeImport.status === "completed_with_errors"
  if (isTerminal && activeImport.skippedCount > 0) {
    return activeImport.skippedCount === 1
      ? "1 e-mail não incluído porque não é um e-mail válido"
      : `${activeImport.skippedCount} e-mails não incluídos porque não são e-mails válidos`
  }
  return `${activeImport.processedRows}/${activeImport.totalRows} linhas processadas`
}

function resolveRadarSecondaryLabel(activeImport: ContactListActiveImport): string | null {
  if (activeImport.failedRadarSync > 0) {
    return `${activeImport.failedRadarSync} falha(s) no Radar`
  }
  if (activeImport.pendingRadarSync > 0) {
    return "Radar em segundo plano"
  }
  return null
}

export function resolveContactImportStatusView(
  activeImport: ContactListActiveImport,
  options?: { compact?: boolean }
): ContactImportStatusView {
  const compact = Boolean(options?.compact)
  const hasFailures =
    activeImport.failedBatchCount > 0 || activeImport.status === "completed_with_errors"

  if (activeImport.status === "failed") {
    return {
      label: "Falha no import",
      secondaryLabel: null,
      compact,
      variant: "destructive",
    }
  }

  if (activeImport.status === "pending" && activeImport.processedRows === 0) {
    return {
      label: "Na fila",
      secondaryLabel: null,
      compact,
      variant: "outline",
    }
  }

  if (
    activeImport.status === "processing" ||
    (activeImport.status === "pending" && activeImport.processedRows > 0)
  ) {
    return {
      label: compact
        ? `Lote ${activeImport.currentBatch}/${activeImport.totalBatches}`
        : `Importando lote ${activeImport.currentBatch}/${activeImport.totalBatches}`,
      secondaryLabel: null,
      compact,
      variant: "outline",
    }
  }

  if (hasFailures) {
    return {
      label: compact ? "Com falhas" : "Importado com falhas",
      secondaryLabel: resolveRadarSecondaryLabel(activeImport),
      compact,
      variant: "secondary",
    }
  }

  if (
    activeImport.status === "completed" ||
    activeImport.status === "completed_with_errors"
  ) {
    return {
      label: compact ? "Importados" : "Contatos importados",
      secondaryLabel: resolveRadarSecondaryLabel(activeImport),
      compact,
      variant: "secondary",
    }
  }

  return {
    label: compact
      ? `Lote ${activeImport.currentBatch}/${activeImport.totalBatches}`
      : `Importando lote ${activeImport.currentBatch}/${activeImport.totalBatches}`,
    secondaryLabel: null,
    compact,
    variant: "outline",
  }
}
