import type { BackofficeEmailContact } from "@prisma/client"

export interface UpsertBackofficeEmailContactInput {
  listId: string
  email: string
  name?: string | null
  customFields?: Record<string, unknown> | null
  backofficeLeadId?: string | null
}

export interface ListBackofficeEmailContactsParams {
  page: number
  pageSize: number
}

export interface ListBackofficeEmailContactsResult {
  contacts: BackofficeEmailContact[]
  total: number
}

export interface IBackofficeEmailContactRepository {
  upsertActive(data: UpsertBackofficeEmailContactInput): Promise<BackofficeEmailContact>
  listByListId(
    listId: string,
    params: ListBackofficeEmailContactsParams
  ): Promise<ListBackofficeEmailContactsResult>
  listActiveByListId(listId: string): Promise<BackofficeEmailContact[]>
  findById(id: string): Promise<BackofficeEmailContact | null>
  markUnsubscribed(id: string): Promise<BackofficeEmailContact>
  markUnsubscribedByEmailInAllLists(email: string): Promise<number>
  markBouncedByEmailInAllLists(email: string): Promise<number>
  markComplainedByEmailInAllLists(email: string): Promise<number>
  delete(id: string): Promise<void>
}
