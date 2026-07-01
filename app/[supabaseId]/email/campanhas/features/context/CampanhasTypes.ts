export type Campaign = {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'canceled' | 'failed'
  scheduledAt: string | null
  sentAt: string | null
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  dispatchCount: number
  createdAt: string
  creator: { fullName: string | null; email: string | null } | null
  template: { id: string; name: string } | null
  contactList: { id: string; name: string } | null
  cdpSegmentSlug?: string | null
}

export type CreditStatus = {
  hasSubscription: boolean
  isBetaExempt?: boolean
  plan: string | null
  monthlyCredits: number
  creditsUsed: number
  creditsAvailable: number
  currentPeriodEnd: string | null
}

export type Template = {
  id: string
  name: string
  subject: string
  status?: 'draft' | 'published'
  isCurrentPublished?: boolean
}

export type ContactList = {
  id: string
  name: string
  totalContacts: number
  activeContacts?: number
}

export type CdpSegmentOption = {
  slug: string
  name: string
  count: number
}

export type CampanhasState = {
  campaigns: Campaign[]
  total: number
  page: number
  totalPages: number
  statusFilter: string
  loading: boolean
  credits: CreditStatus | null
  loadingCredits: boolean
  sendingId: string | null
  cancelingId: string | null
  deletingId: string | null
  // Wizard state
  wizardOpen: boolean
  wizardStep: 1 | 2 | 3
  wizardName: string
  wizardTemplateId: string
  wizardContactListId: string
  wizardRecipientSource: "contact_list" | "cdp_segment"
  wizardCdpSegmentSlug: string
  wizardScheduledAt: string
  wizardCreating: boolean
  templates: Template[]
  contactLists: ContactList[]
  cdpSegments: CdpSegmentOption[]
  // Edit draft state
  editingCampaign: Campaign | null
  editName: string
  editTemplateId: string
  editContactListId: string
  editScheduledAt: string
  editSaving: boolean
}
