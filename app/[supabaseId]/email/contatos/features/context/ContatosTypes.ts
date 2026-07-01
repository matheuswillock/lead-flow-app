export type ContactList = {
  id: string
  name: string
  description: string | null
  totalContacts: number
  isSystemDefault: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    fullName: string | null
    email: string | null
  } | null
}

export type Contact = {
  id: string
  email: string
  name: string | null
  isUnsubscribed: boolean
  isBounced: boolean
  isComplained: boolean
  createdAt: string
}

export type ContactsState = {
  lists: ContactList[]
  selectedListId: string | null
  contacts: Contact[]
  totalContacts: number
  page: number
  totalPages: number
  search: string
  loadingLists: boolean
  loadingContacts: boolean
  deletingContactId: string | null
}
