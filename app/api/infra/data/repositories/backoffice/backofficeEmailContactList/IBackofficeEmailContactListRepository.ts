import type { BackofficeEmailContactList } from "@prisma/client"

export interface CreateBackofficeEmailContactListInput {
  name: string
  isSystemDefault?: boolean
  createdByBackofficeUserId?: string | null
}

export interface IBackofficeEmailContactListRepository {
  create(data: CreateBackofficeEmailContactListInput): Promise<BackofficeEmailContactList>
  findMany(): Promise<BackofficeEmailContactList[]>
  findById(id: string): Promise<BackofficeEmailContactList | null>
  findSystemDefault(): Promise<BackofficeEmailContactList | null>
  getOrCreateSystemDefault(): Promise<BackofficeEmailContactList>
  archive(id: string): Promise<BackofficeEmailContactList>
  incrementTotalContacts(id: string, delta: number): Promise<void>
}
