export interface BackofficeEmailContactListItem {
  id: string
  name: string
  isSystemDefault: boolean
  isArchived: boolean
  totalContacts: number
  createdAt: string
  updatedAt: string
}

export interface BackofficeEmailContactItem {
  id: string
  listId: string
  email: string
  name: string | null
  isUnsubscribed: boolean
  isBounced: boolean
  isComplained: boolean
  createdAt: string
}

export interface BackofficeEmailContactsPage {
  contacts: BackofficeEmailContactItem[]
  total: number
}
