import type {
  BackofficeEmailContactListItem,
  BackofficeEmailContactsPage,
} from "../context/BackofficeEmailContatosTypes"

export interface IBackofficeEmailContatosService {
  listContactLists(): Promise<BackofficeEmailContactListItem[]>
  createContactList(name: string): Promise<BackofficeEmailContactListItem>
  archiveContactList(id: string): Promise<BackofficeEmailContactListItem>
  uploadContacts(listId: string, file: File): Promise<void>
  listContacts(listId: string, page: number, pageSize: number): Promise<BackofficeEmailContactsPage>
  deleteContact(listId: string, contactId: string): Promise<void>
}
