import { describe, expect, it } from "bun:test"
import type { ContactList, ContactListActiveImport } from "../context/ContatosTypes"
import {
  buildContactImportProgressKey,
  decideContactsFetch,
  planForcedContactsRefresh,
  type ContactsRefreshRequest,
} from "./contact-import-refresh"

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

describe("buildContactImportProgressKey", () => {
  it("inclui importId, processedRows, status e pendingRadarSync da lista selecionada", () => {
    const key = buildContactImportProgressKey(
      "list-1",
      makeActiveImport({ processedRows: 750, status: "processing", pendingRadarSync: 4 })
    )
    expect(key).toBe("list-1:import-1:750:processing:4")
  })

  it("retorna string vazia sem lista ou sem activeImport", () => {
    expect(buildContactImportProgressKey(null, makeActiveImport())).toBe("")
    expect(buildContactImportProgressKey("list-1", null)).toBe("")
  })
})

describe("planForcedContactsRefresh", () => {
  it("força refresh quando processedRows da lista selecionada avança", () => {
    const previousKey = buildContactImportProgressKey(
      "list-1",
      makeActiveImport({ processedRows: 500 })
    )
    const nextKey = buildContactImportProgressKey(
      "list-1",
      makeActiveImport({ processedRows: 1000 })
    )

    const plan = planForcedContactsRefresh({
      selectedListId: "list-1",
      previousProgressKey: previousKey,
      nextProgressKey: nextKey,
      page: 1,
      search: "",
      isFetchingContacts: false,
      pendingRefresh: null,
    })

    expect(plan).toEqual({
      action: "fetch",
      request: { listId: "list-1", page: 1, search: "", force: true },
      nextProgressKey: nextKey,
      pendingRefresh: null,
    })
  })

  it("não força refresh quando só muda import de lista não selecionada", () => {
    const selectedImport = makeActiveImport({ processedRows: 500 })
    const previousKey = buildContactImportProgressKey("list-1", selectedImport)
    const nextKey = buildContactImportProgressKey("list-1", selectedImport)

    const lists = [
      makeList("list-1", selectedImport),
      makeList("list-2", makeActiveImport({ importId: "import-2", processedRows: 1000 })),
    ]

    const plan = planForcedContactsRefresh({
      selectedListId: "list-1",
      previousProgressKey: previousKey,
      nextProgressKey: nextKey,
      page: 2,
      search: "maria",
      isFetchingContacts: false,
      pendingRefresh: null,
      lists,
    })

    expect(plan.action).toBe("none")
    expect(plan.request).toBeNull()
  })

  it("enfileira refresh forçado quando já há getContacts em andamento", () => {
    const previousKey = buildContactImportProgressKey(
      "list-1",
      makeActiveImport({ processedRows: 500 })
    )
    const nextKey = buildContactImportProgressKey(
      "list-1",
      makeActiveImport({ processedRows: 1000 })
    )

    const plan = planForcedContactsRefresh({
      selectedListId: "list-1",
      previousProgressKey: previousKey,
      nextProgressKey: nextKey,
      page: 1,
      search: "lead",
      isFetchingContacts: true,
      pendingRefresh: null,
    })

    expect(plan).toEqual({
      action: "queue",
      request: null,
      nextProgressKey: nextKey,
      pendingRefresh: {
        listId: "list-1",
        page: 1,
        search: "lead",
        force: true,
      } satisfies ContactsRefreshRequest,
    })
  })

  it("preserva page e search no refresh incremental", () => {
    const previousKey = buildContactImportProgressKey(
      "list-1",
      makeActiveImport({ processedRows: 500 })
    )
    const nextKey = buildContactImportProgressKey(
      "list-1",
      makeActiveImport({ processedRows: 1000 })
    )

    const plan = planForcedContactsRefresh({
      selectedListId: "list-1",
      previousProgressKey: previousKey,
      nextProgressKey: nextKey,
      page: 3,
      search: "bruno",
      isFetchingContacts: false,
      pendingRefresh: null,
    })

    expect(plan.request).toEqual({
      listId: "list-1",
      page: 3,
      search: "bruno",
      force: true,
    })
  })
})

describe("decideContactsFetch", () => {
  it("enfileira request do usuário (sem force) quando já há getContacts em andamento", () => {
    const decision = decideContactsFetch({
      isFetchingContacts: true,
      force: false,
      listId: "list-1",
      page: 2,
      search: "maria",
      lastContactsKey: "list-1|1|",
    })

    expect(decision).toEqual({
      action: "queue",
      request: {
        listId: "list-1",
        page: 2,
        search: "maria",
        force: false,
      },
    })
  })

  it("enfileira navegação do usuário e não deixa force refresh voltar página antiga", () => {
    const userQueued = decideContactsFetch({
      isFetchingContacts: true,
      force: false,
      listId: "list-1",
      page: 3,
      search: "bruno",
      lastContactsKey: "list-1|1|",
    })
    expect(userQueued).toEqual({
      action: "queue",
      request: {
        listId: "list-1",
        page: 3,
        search: "bruno",
        force: false,
      },
    })

    const forceAfterUser = decideContactsFetch({
      isFetchingContacts: true,
      force: true,
      listId: "list-1",
      page: 1,
      search: "",
      lastContactsKey: "list-1|1|",
      pendingRefresh: userQueued.request,
    })
    expect(forceAfterUser).toEqual({
      action: "queue",
      request: {
        listId: "list-1",
        page: 3,
        search: "bruno",
        force: true,
      },
    })
  })

  it("ignora fetch idêntico sem force quando não há chamada em andamento", () => {
    const decision = decideContactsFetch({
      isFetchingContacts: false,
      force: false,
      listId: "list-1",
      page: 1,
      search: "",
      lastContactsKey: "list-1|1|",
    })
    expect(decision.action).toBe("none")
  })
})
