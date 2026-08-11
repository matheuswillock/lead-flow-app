import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { ContactListActiveImport } from "../context/ContatosTypes"
import { ContactImportStatusBadge } from "./ContactImportStatusBadge"
import { ContatosSelectedListHeader } from "./ContatosSelectedListHeader"

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
    failedRadarSync: 0,
    updatedAt: "2026-08-10T10:05:00.000Z",
    ...overrides,
  }
}

describe("ContactImportStatusBadge", () => {
  it("renderiza Na fila, Importando lote X/Y, Contatos importados, Radar e falhas", () => {
    const pending = renderToStaticMarkup(
      <ContactImportStatusBadge
        activeImport={makeActiveImport({
          status: "pending",
          processedRows: 0,
          currentBatch: 1,
          completedBatches: 0,
        })}
      />
    )
    expect(pending).toContain("Na fila")

    const processing = renderToStaticMarkup(
      <ContactImportStatusBadge activeImport={makeActiveImport()} />
    )
    expect(processing).toContain("Importando lote 2/3")

    const completedWithRadar = renderToStaticMarkup(
      <ContactImportStatusBadge
        activeImport={makeActiveImport({
          status: "completed",
          pendingRadarSync: 5,
          processedRows: 1500,
          completedBatches: 3,
          currentBatch: 3,
        })}
      />
    )
    expect(completedWithRadar).toContain("Contatos importados")
    expect(completedWithRadar).toContain("Radar em segundo plano")

    const withFailures = renderToStaticMarkup(
      <ContactImportStatusBadge
        activeImport={makeActiveImport({
          status: "completed",
          failedBatchCount: 1,
        })}
      />
    )
    expect(withFailures).toContain("Importado com falhas")

    const failed = renderToStaticMarkup(
      <ContactImportStatusBadge activeImport={makeActiveImport({ status: "failed" })} />
    )
    expect(failed).toContain("Falha no import")
  })

  it("em compacto renderiza rótulo curto e mantém Badge", () => {
    const html = renderToStaticMarkup(
      <ContactImportStatusBadge activeImport={makeActiveImport()} compact />
    )
    expect(html).toContain("Lote 2/3")
    expect(html).not.toContain("Importando lote 2/3")
  })

  it("mostra progresso de linhas sem inflar total com updatedCount", () => {
    const html = renderToStaticMarkup(
      <ContactImportStatusBadge
        activeImport={makeActiveImport({
          processedRows: 500,
          totalRows: 1500,
          updatedCount: 999,
        })}
        showProgress
      />
    )
    expect(html).toContain("500/1500 linhas processadas")
    expect(html).not.toContain("999")
  })
})

describe("ContatosSelectedListHeader", () => {
  it("renderiza badge ao lado do título da lista selecionada", () => {
    const html = renderToStaticMarkup(
      <ContatosSelectedListHeader
        listName="Leads agosto"
        activeImport={makeActiveImport()}
      />
    )
    expect(html).toContain("Leads agosto")
    expect(html).toContain("Importando lote 2/3")
  })
})
