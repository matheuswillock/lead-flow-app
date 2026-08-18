import type { ContactListActiveImport } from "../context/ContatosTypes"

export type ContactImportStatusView = {
  label: string
  secondaryLabel: string | null
  compact: boolean
  variant: "outline" | "secondary" | "destructive"
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
