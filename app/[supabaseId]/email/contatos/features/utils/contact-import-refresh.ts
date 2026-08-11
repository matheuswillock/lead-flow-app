import type { ContactList, ContactListActiveImport } from "../context/ContatosTypes"

export type ContactsRefreshRequest = {
  listId: string
  page: number
  search: string
  force: boolean
}

export type ContactsFetchDecision = {
  action: "none" | "fetch" | "queue"
  request: ContactsRefreshRequest | null
}

/**
 * Decide se um fetch de contatos deve rodar agora, ser enfileirado ou ignorado.
 * Enquanto há fetch em andamento, a solicitação é enfileirada. Navegação do usuário
 * (sem force) tem prioridade sobre um force refresh já pendente; um force novo
 * reutiliza page/search da navegação pendente para não voltar a página antiga.
 */
export function decideContactsFetch(input: {
  isFetchingContacts: boolean
  force: boolean
  listId: string
  page: number
  search: string
  lastContactsKey: string
  pendingRefresh?: ContactsRefreshRequest | null
}): ContactsFetchDecision {
  const request: ContactsRefreshRequest = {
    listId: input.listId,
    page: input.page,
    search: input.search,
    force: input.force,
  }
  const key = `${input.listId}|${input.page}|${input.search}`

  if (input.isFetchingContacts) {
    const pending = input.pendingRefresh ?? null
    if (pending && request.force && !pending.force) {
      return {
        action: "queue",
        request: {
          listId: pending.listId,
          page: pending.page,
          search: pending.search,
          force: true,
        },
      }
    }
    return { action: "queue", request }
  }

  if (!input.force && input.lastContactsKey === key) {
    return { action: "none", request: null }
  }

  return { action: "fetch", request }
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
