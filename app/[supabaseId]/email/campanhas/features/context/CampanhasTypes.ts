export type Campaign = {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'canceled' | 'failed' | 'archived'
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
  errorMessage?: string | null
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

export type CampaignSheetTab = "campaign" | "logs"

export type CampaignLogStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"

export type CampaignEmailLog = {
  id: string
  recipientEmail: string
  recipientName: string | null
  subject: string
  status: CampaignLogStatus
  sentAt: string | null
  deliveredAt: string | null
  openedAt: string | null
  clickedAt: string | null
  bouncedAt: string | null
  complainedAt: string | null
  campaignId: string | null
  campaign?: { id: string; name: string } | null
  dispatch?: {
    contactListName: string | null
    cdpSegmentSlug: string | null
  } | null
}

export type CampaignEmailEvent = {
  id: string
  type: string
  occurredAt: string
  metadata: Record<string, string> | null
}

export type CampaignLogDetail = CampaignEmailLog & { events: CampaignEmailEvent[] }

export type CampanhasState = {
  campaigns: Campaign[]
  total: number
  page: number
  totalPages: number
  statusFilter: string[]
  loading: boolean
  credits: CreditStatus | null
  loadingCredits: boolean
  pageSize: number
  nameFilter: string
  dateFrom: string
  dateTo: string
  sendingId: string | null
  cancelingId: string | null
  deletingId: string | null
  archivingId: string | null
  // Wizard state
  wizardOpen: boolean
  wizardStep: 1 | 2 | 3
  wizardName: string
  wizardTemplateId: string
  wizardContactListId: string
  wizardRecipientSource: "contact_list" | "cdp_segment"
  wizardCdpSegmentSlug: string
  wizardScheduledAt: Date | undefined
  wizardCreating: boolean
  templates: Template[]
  contactLists: ContactList[]
  cdpSegments: CdpSegmentOption[]
  // Detail sheet state
  detailCampaign: Campaign | null
  sheetTab: CampaignSheetTab
  editName: string
  editTemplateId: string
  editContactListId: string
  editScheduledAt: Date | undefined
  editSaving: boolean
}
