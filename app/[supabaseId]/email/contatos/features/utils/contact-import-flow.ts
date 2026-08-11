import type { ContactList } from "../context/ContatosTypes"
import {
  buildContactImportProgressKey,
  planForcedContactsRefresh,
  type ContactsRefreshRequest,
} from "./contact-import-refresh"

export type ContactImportUiState = {
  selectedListId: string | null
  page: number
  search: string
  lastProgressKey: string
  isFetchingContacts: boolean
  pendingRefresh: ContactsRefreshRequest | null
}

export type ContactListsPollResult = {
  action: "none" | "fetch" | "queue"
  request: ContactsRefreshRequest | null
  nextState: {
    lastProgressKey: string
    pendingRefresh: ContactsRefreshRequest | null
  }
  shouldPoll: boolean
}

export function shouldPollContactLists(lists: ContactList[]): boolean {
  return lists.some((list) => list.activeImport != null)
}

export function onContactListsPolled(
  state: ContactImportUiState,
  lists: ContactList[]
): ContactListsPollResult {
  const selectedList =
    lists.find((list) => list.id === state.selectedListId) ?? null
  const nextProgressKey = buildContactImportProgressKey(
    state.selectedListId,
    selectedList?.activeImport
  )

  const plan = planForcedContactsRefresh({
    selectedListId: state.selectedListId,
    previousProgressKey: state.lastProgressKey,
    nextProgressKey,
    page: state.page,
    search: state.search,
    isFetchingContacts: state.isFetchingContacts,
    pendingRefresh: state.pendingRefresh,
    lists,
  })

  return {
    action: plan.action,
    request: plan.request,
    nextState: {
      lastProgressKey: plan.nextProgressKey,
      pendingRefresh: plan.pendingRefresh,
    },
    shouldPoll: shouldPollContactLists(lists),
  }
}
