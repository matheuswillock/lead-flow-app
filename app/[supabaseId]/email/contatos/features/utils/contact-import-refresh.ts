import type { ContactList, ContactListActiveImport } from "../context/ContatosTypes"

export type ContactsRefreshRequest = {
  listId: string
  page: number
  search: string
  force: true
}

export type ForcedContactsRefreshPlan = {
  action: "none" | "fetch" | "queue"
  request: ContactsRefreshRequest | null
  nextProgressKey: string
  pendingRefresh: ContactsRefreshRequest | null
}

export function buildContactImportProgressKey(
  selectedListId: string | null,
  activeImport: ContactListActiveImport | null | undefined
): string {
  if (!selectedListId || !activeImport) return ""
  return `${selectedListId}:${activeImport.importId}:${activeImport.processedRows}:${activeImport.status}:${activeImport.pendingRadarSync}`
}

export function planForcedContactsRefresh(input: {
  selectedListId: string | null
  previousProgressKey: string
  nextProgressKey: string
  page: number
  search: string
  isFetchingContacts: boolean
  pendingRefresh: ContactsRefreshRequest | null
  lists?: ContactList[]
}): ForcedContactsRefreshPlan {
  const {
    selectedListId,
    previousProgressKey,
    nextProgressKey,
    page,
    search,
    isFetchingContacts,
    pendingRefresh,
  } = input

  if (!selectedListId) {
    return {
      action: "none",
      request: null,
      nextProgressKey: "",
      pendingRefresh: null,
    }
  }

  // Sem activeImport na lista selecionada: limpa a chave para não manter polling/badge.
  if (!nextProgressKey) {
    return {
      action: "none",
      request: null,
      nextProgressKey: "",
      pendingRefresh: null,
    }
  }

  // Primeira observação do progresso (ou chave inalterada): só memoriza, sem refresh.
  if (!previousProgressKey || previousProgressKey === nextProgressKey) {
    return {
      action: "none",
      request: null,
      nextProgressKey,
      pendingRefresh,
    }
  }

  const request: ContactsRefreshRequest = {
    listId: selectedListId,
    page,
    search,
    force: true,
  }

  if (isFetchingContacts) {
    return {
      action: "queue",
      request: null,
      nextProgressKey,
      pendingRefresh: request,
    }
  }

  return {
    action: "fetch",
    request,
    nextProgressKey,
    pendingRefresh: null,
  }
}
