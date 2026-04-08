import type { ContactList, Contact } from '../context/ContatosTypes'

export type CreateListData = { name: string; description?: string }

export type GetContactsResult = {
  contacts: Contact[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type UploadCsvResult = {
  imported: number
  updated: number
  total: number
}

export interface IContatosService {
  getLists(): Promise<ContactList[]>
  createList(data: CreateListData): Promise<ContactList>
  deleteList(id: string): Promise<void>
  getContacts(listId: string, page: number, pageSize: number, search: string): Promise<GetContactsResult>
  uploadCsv(listId: string, file: File): Promise<UploadCsvResult>
  deleteContact(listId: string, contactId: string): Promise<void>
}
