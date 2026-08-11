import { describe, expect, it } from "bun:test"
import type { ContactListActiveImport } from "../context/ContatosTypes"
import {
  resolveContactImportProgressLabel,
  resolveContactImportStatusView,
} from "./contact-import-status"

function makeActiveImport(
  overrides: Partial<ContactListActiveImport> = {}
): ContactListActiveImport {
  return {
    importId: "import-1",
    status: "processing",
    processedRows: 500,
    totalRows: 1500,
    importedCount: 480,
    updatedCount: 20,
    skippedCount: 0,
    failedBatchCount: 0,
    completedBatches: 1,
    currentBatch: 2,
    totalBatches: 3,
    pendingRadarSync: 0,
    updatedAt: "2026-08-10T10:05:00.000Z",
    ...overrides,
  }
}

describe("resolveContactImportStatusView", () => {
  it("retorna Na fila para import pending sem linhas processadas", () => {
    const view = resolveContactImportStatusView(
      makeActiveImport({ status: "pending", processedRows: 0, currentBatch: 1, completedBatches: 0 })
    )
    expect(view).toMatchObject({
      label: "Na fila",
      secondaryLabel: null,
    })
  })

  it("retorna Importando lote X/Y para processing", () => {
    const view = resolveContactImportStatusView(makeActiveImport())
    expect(view).toMatchObject({
      label: "Importando lote 2/3",
      secondaryLabel: null,
    })
  })

  it("retorna Contatos importados e Radar em segundo plano quando completed com Radar pendente", () => {
    const view = resolveContactImportStatusView(
      makeActiveImport({
        status: "completed",
        processedRows: 1500,
        completedBatches: 3,
        currentBatch: 3,
        pendingRadarSync: 12,
      })
    )
    expect(view).toMatchObject({
      label: "Contatos importados",
      secondaryLabel: "Radar em segundo plano",
    })
  })

  it("retorna Importado com falhas quando há lotes falhos no terminal", () => {
    const view = resolveContactImportStatusView(
      makeActiveImport({
        status: "completed",
        failedBatchCount: 2,
        pendingRadarSync: 0,
      })
    )
    expect(view.label).toBe("Importado com falhas")
  })

  it("retorna Falha no import para status failed", () => {
    const view = resolveContactImportStatusView(
      makeActiveImport({ status: "failed", failedBatchCount: 1 })
    )
    expect(view.label).toBe("Falha no import")
  })

  it("em modo compacto usa rótulo curto sem substituir o progresso principal", () => {
    const view = resolveContactImportStatusView(makeActiveImport(), { compact: true })
    expect(view.label).toBe("Lote 2/3")
    expect(view.compact).toBe(true)
  })
})

describe("resolveContactImportProgressLabel", () => {
  it("mostra processedRows/totalRows e não infla com updatedCount", () => {
    const label = resolveContactImportProgressLabel(
      makeActiveImport({
        processedRows: 500,
        totalRows: 1500,
        importedCount: 480,
        updatedCount: 999,
      })
    )
    expect(label).toBe("500/1500 linhas processadas")
    expect(label).not.toContain("999")
  })
})
