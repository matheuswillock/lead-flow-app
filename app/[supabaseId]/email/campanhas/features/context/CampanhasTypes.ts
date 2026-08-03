export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "canceled"
  | "failed"
  | "archived"

export type SubCampaignSummary = {
  id: string
  name: string
  status: CampaignStatus
  scheduledAt: string | null
  sentAt: string | null
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  subCampaignIndex: number | null
  contactListId?: string | null
  errorMessage?: string | null
}

export type Campaign = {
  id: string
  name: string
  parentCampaignId?: string | null
  templateId?: string
  contactListId?: string | null
  audienceContactIds?: string[]
  sourceContactListIds?: string[]
  linkedForm?: { id: string; name: string; publicId: string } | null
  status: CampaignStatus
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
  template: { id: string; name: string; subject?: string } | null
  contactList: { id: string; name: string; totalContacts?: number; activeContacts?: number } | null
  radarSegmentSlug?: string | null
  errorMessage?: string | null
  subCampaignCount?: number
  isParentCampaign?: boolean
  subCampaigns?: SubCampaignSummary[]
  managedByCorretorStudio?: boolean
}

export type CreditStatus = {
  hasSubscription: boolean
  isBetaExempt?: boolean
  plan: string | null
  monthlyCredits: number
  creditsUsed: number
  creditsAvailable: number
  currentPeriodEnd: string | null
  dailyDispatch?: {
    limit: number | null
    used: number
    remaining: number | null
    isUnlimited: boolean
  }
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

export type RadarSegmentOption = {
  slug: string
  name: string
  count: number
  isSystem: boolean
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
    radarSegmentSlug: string | null
  } | null
}

export type CampaignEmailEvent = {
  id: string
  type: string
  occurredAt: string
  metadata: Record<string, string> | null
}

export type CampaignLogDetail = CampaignEmailLog & { events: CampaignEmailEvent[] }

export type CampaignPreviewPlan = {
  subCampaigns: Array<{
    index: number
    name: string
    totalRecipients: number
    scheduledAt?: string | null
    contactListId?: string | null
    listName?: string | null
  }>
  needsSplit: boolean
  totalRecipients: number
}

export type WizardTabId = "geral" | "template" | "audiencia" | "agendamento" | "subcampanhas"

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
  wizardMode: "create" | "edit"
  wizardCampaignId?: string
  wizardActiveTab: WizardTabId
  wizardName: string
  wizardTemplateId: string
  wizardContactListIds: string[]
  wizardListStrategy: "single" | "merge" | "per_list"
  wizardRecipientSource: "contact_list" | "radar_segment"
  wizardRadarSegmentSlug: string
  wizardScheduledAt: Date | undefined
  wizardUniformSchedule: boolean
  wizardScheduleIntervalDays: number
  wizardSubCampaignSchedules: Array<{ index: number; scheduledAt: Date }>
  wizardSubCampaignListIds: Record<number, string>
  wizardPreviewPlan: CampaignPreviewPlan | null
  wizardPreviewLoading: boolean
  wizardLinkedForm: { id: string; name: string; publicId: string } | null
  wizardSaving: boolean
  wizardHydrating: boolean
  materializingSegment: boolean
  templates: Template[]
  contactLists: ContactList[]
  radarSegments: RadarSegmentOption[]
  // Detail sheet state
  detailCampaign: Campaign | null
  sheetTab: CampaignSheetTab
}
