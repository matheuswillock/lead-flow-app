import { Output } from "@/lib/output"
import type { BackofficeEmailImportSourceFormat } from "@prisma/client"

export interface CreateBackofficeEmailContactListData {
  name: string
}

export interface IBackofficeEmailContactListUseCase {
  list(): Promise<Output>
  create(data: CreateBackofficeEmailContactListData, backofficeUserId: string): Promise<Output>
  getById(id: string): Promise<Output>
  archive(id: string): Promise<Output>
  listContacts(id: string, page: number, pageSize: number): Promise<Output>
  updateContact(
    listId: string,
    contactId: string,
    data: { name?: string | null }
  ): Promise<Output>
  deleteContact(listId: string, contactId: string): Promise<Output>
  enqueueUpload(
    listId: string,
    sourceFormat: BackofficeEmailImportSourceFormat,
    rawContent: string,
    backofficeUserId: string
  ): Promise<Output>
}
