import type { ContactList, Contact } from '../context/ContatosTypes'
import type { EmailContactImportRow } from '@/lib/emailContactImport/emailContactImportFields'

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

export type EmailContactImportIssue = {
  line?: number
  email?: string
  name?: string
  reason: string
}

export type EmailContactImportResult = {
  imported: number
  updated: number
  skipped: number
  total: number
  issues: EmailContactImportIssue[]
}

export interface IContatosService {
  getLists(): Promise<ContactList[]>
  createList(data: CreateListData): Promise<ContactList>
  deleteList(id: string): Promise<void>
  getContacts(listId: string, page: number, pageSize: number, search: string): Promise<GetContactsResult>
  uploadCsv(listId: string, file: File): Promise<UploadCsvResult>
  importMapped(listId: string, rows: EmailContactImportRow[]): Promise<EmailContactImportResult>
  importMappedInBatches(
    listId: string,
    rows: EmailContactImportRow[],
    options?: {
      onProgress?: (processed: number, total: number) => void
    }
  ): Promise<EmailContactImportResult>
  deleteContact(listId: string, contactId: string): Promise<void>
  addContact(listId: string, email: string, name?: string): Promise<void>
}
