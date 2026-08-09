export type StudioEmailCampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "canceled"
  | "failed"
  | "archived"

export type StudioEmailCampaign = {
  id: string
  name: string
  status: string
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
  radarSegmentSlug?: string | null
  errorMessage?: string | null
  managedByCorretorStudio?: boolean
}

export type StudioEmailContactList = {
  id: string
  name: string
  description: string | null
  totalContacts: number
  isSystemDefault?: boolean
  isBlocklist?: boolean
  creator: { fullName: string | null; email: string | null } | null
  managedByCorretorStudio?: boolean
}

export type StudioEmailContact = {
  id: string
  email: string
  name: string | null
  customFields?: Record<string, string> | null
}

export type StudioEmailTemplate = {
  id: string
  name: string
  subject: string
  status: string
  approvalStatus?: string
  creator: { fullName: string | null; email: string | null } | null
  managedByCorretorStudio?: boolean
  updatedAt?: string
  previewText?: string | null
  html?: string | null
  mailyJson?: unknown
  editorMode?: "blocks" | "html"
  variables?: unknown[]
  isCurrentPublished?: boolean
}

export type StudioEmailTemplateVersion = {
  id: string
  versionNumber: number
  createdAt: string
  createdBy: { fullName: string | null; email: string | null } | null
}

export type StudioEmailAnalytics = {
  period: { from: string; to: string }
  totals: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
  }
  rates: {
    deliverabilityRate: number
    openRate: number
    clickRate: number
    bounceRate: number
  }
}

export type StudioEmailLogStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"

export type StudioEmailLog = {
  id: string
  recipientEmail: string
  recipientName: string | null
  subject: string | null
  status: string
  sentAt: string | null
  campaign: { id: string; name: string } | null
}

export type StudioEmailLogDetail = StudioEmailLog & {
  deliveredAt?: string | null
  openedAt?: string | null
  clickedAt?: string | null
  bouncedAt?: string | null
  complainedAt?: string | null
  campaignId?: string | null
  events?: Array<{
    id: string
    type: string
    occurredAt: string
    metadata: Record<string, string> | null
  }>
}

export type StudioEmailCampaignLog = StudioEmailLog & {
  campaignId?: string | null
  deliveredAt?: string | null
  openedAt?: string | null
  clickedAt?: string | null
  bouncedAt?: string | null
  complainedAt?: string | null
}

export type StudioEmailResendDomainStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "temporary_failure"
  | "partially_verified"
  | "partially_failed"

export type StudioEmailDomainRecord = {
  record?: string
  type: string
  name: string
  value: string
  ttl: string
  priority?: number
  status?: string
}

export type StudioEmailDomain = {
  domainId: string
  domainName: string
  status: StudioEmailResendDomainStatus
  region?: string | null
  connectedAt?: string | null
  openTracking?: boolean
  clickTracking?: boolean
  trackingSubdomain?: string | null
}

export type StudioEmailDomainConnectResult = StudioEmailDomain & {
  records: StudioEmailDomainRecord[]
  events?: Array<{
    id: string
    type: string
    occurredAt: string
    metadata: Record<string, unknown> | null
  }>
}

export type StudioEmailSender = {
  id: string
  name: string
  email: string
  replyTo: string | null
  isDefault: boolean
}

export type StudioEmailVariable = {
  id: string
  key: string
  type: "string" | "number"
  defaultValue: string | null
  description: string | null
  isActive: boolean
  valueSource: "STATIC" | "RADAR"
  radarFieldKey: string | null
}

export type StudioEmailSettings = {
  fromName: string
  fromEmail: string
  replyTo: string | null
  dispatchBlockedDates: Array<{ date: string } | { from: string; to: string }> | null
  dispatchTimeFrom: string | null
  dispatchTimeTo: string | null
  dispatchAllowedRoles: string[]
  templateCreateRoles: string[]
  templateApprovalRequired: boolean
  templateApprovalRoles: string[]
  blockedDispatchDays: number[] | null
}

export type CreateStudioEmailCampaignData = {
  name: string
  templateId: string
  contactListId?: string
  radarSegmentSlug?: string
  scheduledAt?: string | null
  scheduleIntervalDays?: number | null
}

export type UpdateStudioEmailCampaignData = Partial<CreateStudioEmailCampaignData>

export type StudioEmailSendCampaignResult = {
  campaignId: string
  dispatchId: string
  totalRecipients: number
  status: "sending"
}

export type StudioEmailContactImportRow = {
  line?: number
  email: string
  name?: string
  customFields?: Record<string, string>
}

export type StudioEmailContactImportEnqueueResult = {
  importId: string
}

export type CreateStudioEmailTemplateData = {
  name: string
  subject: string
  previewText?: string
  mailyJson?: unknown
  html?: string
  editorMode?: "blocks" | "html"
  variables?: unknown[]
}

export type UpdateStudioEmailTemplateData = Partial<CreateStudioEmailTemplateData>

export type StudioEmailTemplateTestData = {
  to: string
  variables?: Record<string, string>
}

export type UpdateStudioEmailSettingsData = {
  dispatchBlockedDates?: StudioEmailSettings["dispatchBlockedDates"]
  dispatchTimeFrom?: string | null
  dispatchTimeTo?: string | null
  dispatchAllowedRoles?: string[]
  templateCreateRoles?: string[]
  templateApprovalRequired?: boolean
  templateApprovalRoles?: string[]
  blockedDispatchDays?: number[] | null
}

export type UpsertStudioEmailSenderData = {
  name: string
  email: string
  replyTo?: string | null
}

export type UpsertStudioEmailVariableData = {
  key: string
  type?: "string" | "number"
  defaultValue?: string | null
  description?: string | null
  isActive?: boolean
  valueSource?: "STATIC" | "RADAR"
  radarFieldKey?: string | null
}

export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type PaginatedContactsResult<T> = {
  contacts: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface IBackofficeStudioEmailService {
  listCampaigns(
    masterId: string,
    teamId: string,
    params?: {
      page?: number
      pageSize?: number
      name?: string
      status?: string[]
      createdAtFrom?: string
      createdAtTo?: string
    }
  ): Promise<{ campaigns: StudioEmailCampaign[]; total: number; page?: number; pageSize?: number; totalPages?: number }>

  getCampaign(masterId: string, teamId: string, campaignId: string): Promise<StudioEmailCampaign>

  createCampaign(
    masterId: string,
    teamId: string,
    data: CreateStudioEmailCampaignData
  ): Promise<StudioEmailCampaign>

  updateCampaign(
    masterId: string,
    teamId: string,
    campaignId: string,
    data: UpdateStudioEmailCampaignData
  ): Promise<StudioEmailCampaign>

  sendCampaign(
    masterId: string,
    teamId: string,
    campaignId: string
  ): Promise<StudioEmailSendCampaignResult>

  cancelCampaign(masterId: string, teamId: string, campaignId: string): Promise<void>

  archiveCampaign(masterId: string, teamId: string, campaignId: string): Promise<void>

  getCampaignLogs(
    masterId: string,
    teamId: string,
    campaignId: string,
    params: { page: number; pageSize: number; search?: string; status?: string[] }
  ): Promise<PaginatedResult<StudioEmailCampaignLog>>

  getCampaignLogDetail(
    masterId: string,
    teamId: string,
    logId: string
  ): Promise<StudioEmailLogDetail>

  getCampaignAnalytics(
    masterId: string,
    teamId: string,
    params: { from: string; to: string; campaignId: string }
  ): Promise<StudioEmailAnalytics>

  listContactLists(masterId: string, teamId: string): Promise<StudioEmailContactList[]>

  getContactList(
    masterId: string,
    teamId: string,
    listId: string
  ): Promise<StudioEmailContactList>

  createContactList(
    masterId: string,
    teamId: string,
    data: { name: string; description?: string }
  ): Promise<StudioEmailContactList>

  updateContactList(
    masterId: string,
    teamId: string,
    listId: string,
    data: { name?: string; description?: string }
  ): Promise<StudioEmailContactList>

  deleteContactList(masterId: string, teamId: string, listId: string): Promise<void>

  listContacts(
    masterId: string,
    teamId: string,
    listId: string,
    params?: { page?: number; pageSize?: number; search?: string }
  ): Promise<PaginatedContactsResult<StudioEmailContact>>

  addContact(
    masterId: string,
    teamId: string,
    listId: string,
    data: { email: string; name?: string | null }
  ): Promise<void>

  deleteContact(
    masterId: string,
    teamId: string,
    listId: string,
    contactId: string
  ): Promise<void>

  uploadContacts(
    masterId: string,
    teamId: string,
    listId: string,
    file: File
  ): Promise<StudioEmailContactImportEnqueueResult>

  importMappedContacts(
    masterId: string,
    teamId: string,
    listId: string,
    rows: StudioEmailContactImportRow[]
  ): Promise<StudioEmailContactImportEnqueueResult>

  listTemplates(
    masterId: string,
    teamId: string,
    params?: { scope?: "campaign" | "workbench"; approvalFilter?: "all" | "pending_approval" | "approved" | "rejected" }
  ): Promise<StudioEmailTemplate[]>

  getTemplate(masterId: string, teamId: string, templateId: string): Promise<StudioEmailTemplate>

  createTemplate(
    masterId: string,
    teamId: string,
    data: CreateStudioEmailTemplateData
  ): Promise<StudioEmailTemplate>

  updateTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    data: UpdateStudioEmailTemplateData
  ): Promise<StudioEmailTemplate>

  publishTemplate(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<StudioEmailTemplate>

  unpublishTemplate(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<StudioEmailTemplate>

  submitTemplate(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<StudioEmailTemplate>

  approveTemplate(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<StudioEmailTemplate>

  rejectTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    reviewNote: string
  ): Promise<StudioEmailTemplate>

  testTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    data: StudioEmailTemplateTestData
  ): Promise<void>

  listTemplateVersions(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<{ versions: StudioEmailTemplateVersion[] }>

  restoreTemplateVersion(
    masterId: string,
    teamId: string,
    templateId: string,
    versionId: string
  ): Promise<StudioEmailTemplate>

  listLogs(
    masterId: string,
    teamId: string,
    params?: {
      page?: number
      pageSize?: number
      search?: string
      status?: string[]
      category?: string
      campaignId?: string
      from?: string
      to?: string
    }
  ): Promise<PaginatedResult<StudioEmailLog>>

  getLog(masterId: string, teamId: string, logId: string): Promise<StudioEmailLogDetail>

  getSettings(masterId: string, teamId: string): Promise<StudioEmailSettings>

  updateSettings(
    masterId: string,
    teamId: string,
    data: UpdateStudioEmailSettingsData
  ): Promise<StudioEmailSettings>

  listSenders(masterId: string, teamId: string): Promise<StudioEmailSender[]>

  createSender(
    masterId: string,
    teamId: string,
    data: UpsertStudioEmailSenderData
  ): Promise<StudioEmailSender>

  updateSender(
    masterId: string,
    teamId: string,
    senderId: string,
    data: UpsertStudioEmailSenderData
  ): Promise<StudioEmailSender>

  deleteSender(masterId: string, teamId: string, senderId: string): Promise<void>

  setDefaultSender(masterId: string, teamId: string, senderId: string): Promise<StudioEmailSettings>

  getDomain(masterId: string, teamId: string): Promise<StudioEmailDomain | null>

  setDomain(masterId: string, teamId: string, domainName: string): Promise<StudioEmailDomainConnectResult>

  verifyDomain(
    masterId: string,
    teamId: string
  ): Promise<{ status: StudioEmailResendDomainStatus }>

  getDomainRecords(masterId: string, teamId: string): Promise<StudioEmailDomainConnectResult>

  configureDomainTracking(
    masterId: string,
    teamId: string,
    data: {
      trackingSubdomain: string
      openTracking: boolean
      clickTracking: boolean
    }
  ): Promise<StudioEmailDomainConnectResult>

  listVariables(masterId: string, teamId: string): Promise<StudioEmailVariable[]>

  createVariable(
    masterId: string,
    teamId: string,
    data: UpsertStudioEmailVariableData
  ): Promise<StudioEmailVariable>

  updateVariable(
    masterId: string,
    teamId: string,
    variableId: string,
    data: UpsertStudioEmailVariableData
  ): Promise<StudioEmailVariable>

  deleteVariable(masterId: string, teamId: string, variableId: string): Promise<void>

  getAnalytics(
    masterId: string,
    teamId: string,
    params?: { from?: string; to?: string; campaignId?: string }
  ): Promise<StudioEmailAnalytics>
}
