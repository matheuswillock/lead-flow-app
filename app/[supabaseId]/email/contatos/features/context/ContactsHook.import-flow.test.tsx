import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { ContactList, ContactListActiveImport } from "./ContatosTypes"
import { ContactImportStatusBadge } from "../components/ContactImportStatusBadge"
import {
  onContactListsPolled,
  shouldPollContactLists,
  type ContactImportUiState,
} from "../utils/contact-import-flow"

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

function makeList(
  id: string,
  activeImport: ContactListActiveImport | null
): ContactList {
  return {
    id,
    name: id,
    description: null,
    totalContacts: 0,
    isSystemDefault: false,
    isBlocklist: false,
    isArchived: false,
    radarSegmentId: null,
    radarSegment: null,
    createdAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-08-10T10:00:00.000Z",
    creator: null,
    activeImport,
  }
}

function makeState(
  overrides: Partial<ContactImportUiState> = {}
): ContactImportUiState {
  return {
    selectedListId: "list-1",
    page: 1,
    search: "",
    lastProgressKey: "list-1:import-1:500:processing:0",
    isFetchingContacts: false,
    pendingRefresh: null,
    ...overrides,
  }
}

describe("ContactsHook import flow — regressão integrada", () => {
  it("poll lists -> processedRows aumenta -> agenda refresh forçado de contacts", () => {
    const state = makeState()
    const listsAfterPoll = [
      makeList(
        "list-1",
        makeActiveImport({
          processedRows: 1000,
          completedBatches: 2,
          currentBatch: 3,
        })
      ),
    ]

    const result = onContactListsPolled(state, listsAfterPoll)

    expect(shouldPollContactLists(listsAfterPoll)).toBe(true)
    expect(result.action).toBe("fetch")
    expect(result.request).toEqual({
      listId: "list-1",
      page: 1,
      search: "",
      force: true,
    })
    expect(result.nextState.lastProgressKey).toBe(
      "list-1:import-1:1000:processing:0"
    )
  })

  it("completed + pendingRadarSync > 0 não mantém UI em importando contatos", () => {
    const activeImport = makeActiveImport({
      status: "completed",
      processedRows: 1500,
      completedBatches: 3,
      currentBatch: 3,
      pendingRadarSync: 8,
    })
    const lists = [makeList("list-1", activeImport)]
    const html = renderToStaticMarkup(
      <ContactImportStatusBadge activeImport={activeImport} showProgress />
    )

    expect(shouldPollContactLists(lists)).toBe(true)
    expect(html).toContain("Contatos importados")
    expect(html).toContain("Radar em segundo plano")
    expect(html).not.toContain("Importando lote")
  })

  it("sem activeImport e sem pendingRadarSync para o polling", () => {
    const lists = [makeList("list-1", null), makeList("list-2", null)]
    expect(shouldPollContactLists(lists)).toBe(false)
  })

  it("status terminal antigo sem Radar pendente não mantém polling nem badge", () => {
    // A API já omite activeImport nesse caso; a UI deve parar o polling.
    const lists = [makeList("list-1", null)]
    expect(shouldPollContactLists(lists)).toBe(false)

    const state = makeState({
      lastProgressKey: "list-1:import-old:1500:completed:0",
    })
    const result = onContactListsPolled(state, lists)
    expect(result.action).toBe("none")
    expect(result.request).toBeNull()
    expect(result.nextState.lastProgressKey).toBe("")
  })

  it("enfileira refresh parcial quando getContacts anterior ainda está em andamento", () => {
    const state = makeState({
      isFetchingContacts: true,
      page: 2,
      search: "maria",
    })
    const listsAfterPoll = [
      makeList(
        "list-1",
        makeActiveImport({
          processedRows: 1000,
          completedBatches: 2,
          currentBatch: 3,
        })
      ),
    ]

    const result = onContactListsPolled(state, listsAfterPoll)

    expect(result.action).toBe("queue")
    expect(result.request).toBeNull()
    expect(result.nextState.pendingRefresh).toEqual({
      listId: "list-1",
      page: 2,
      search: "maria",
      force: true,
    })
  })

  it("mudança só em lista não selecionada não força refresh da tabela atual", () => {
    const selectedImport = makeActiveImport({ processedRows: 500 })
    const state = makeState({
      lastProgressKey: "list-1:import-1:500:processing:0",
    })
    const listsAfterPoll = [
      makeList("list-1", selectedImport),
      makeList(
        "list-2",
        makeActiveImport({
          importId: "import-2",
          processedRows: 1500,
          status: "completed",
          pendingRadarSync: 3,
        })
      ),
    ]

    const result = onContactListsPolled(state, listsAfterPoll)
    expect(result.action).toBe("none")
    expect(result.request).toBeNull()
    expect(shouldPollContactLists(listsAfterPoll)).toBe(true)
  })
})
