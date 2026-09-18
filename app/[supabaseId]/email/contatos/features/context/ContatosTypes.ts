export type ContactListActiveImport = {
  importId: string
  status: string
  processedRows: number
  totalRows: number
  importedCount: number
  updatedCount: number
  skippedCount: number
  failedBatchCount: number
  completedBatches: number
  currentBatch: number
  totalBatches: number
  pendingRadarSync: number
  failedRadarSync: number
  /** Veredito do gate de importação: contagens por categoria de remoção. */
  validationCounts?: Record<string, number> | null
  /** low | medium | high — high quarentena a lista alvo. */
  riskLevel?: string | null
  updatedAt: string
}

export type ContactList = {
  id: string
  name: string
  description: string | null
  totalContacts: number
  isSystemDefault: boolean
  isBlocklist: boolean
  isArchived: boolean
  /** Quarentena do gate de importação — lista fora de audiência até liberação. */
  isQuarantined?: boolean
  quarantinedAt?: string | null
  quarantineReason?: string | null
  radarSegmentId: string | null
  radarSegment: { name: string } | null
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    fullName: string | null
    email: string | null
  } | null
  activeImport?: ContactListActiveImport | null
  managedByCorretorStudio?: boolean
}

export type ContactUnsubscribeSource = {
  campaignId: string | null
  campaignName: string | null
  subject: string | null
  unsubscribedAt: string
}

export type Contact = {
  id: string
  email: string
  name: string | null
  isUnsubscribed: boolean
  isBounced: boolean
  isComplained: boolean
  createdAt: string
  unsubscribeSource?: ContactUnsubscribeSource | null
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
