export type DialerCampaignStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'canceled'
  | 'limit_reached'

export interface DialerCampaign {
  id: string
  name: string
  description: string | null
  status: DialerCampaignStatus
  totalContacts: number
  contactsProcessed: number
  contactsAnswered: number
  minutesUsed: number
  answerRate: number
  managerName: string | null
  createdAt: string
  updatedAt: string
}

export interface DialerContact {
  id: string
  name: string
  phone: string
  email: string | null
  processed: boolean
  position: number
}

export interface DialerContactsPage {
  contacts: DialerContact[]
  total: number
  page: number
  pageSize: number
}

export interface UploadContactsResult {
  inserted: number
  totalContacts: number
  invalidRows: number
  duplicates: number
  errors: string[]
}

export interface DialerState {
  campaigns: DialerCampaign[]
  loading: boolean
  error: string | null
  creating: boolean
  uploading: boolean
  deleting: string | null
}
