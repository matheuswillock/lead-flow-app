import type {
  Campaign,
  CampaignEmailLog,
  CampaignLogDetail,
  ContactList,
  CreditStatus,
  Template as CampaignTemplate,
} from "@/app/[supabaseId]/email/campanhas/features/context/CampanhasTypes"
import type {
  AnalyticsData,
  AnalyticsPeriod,
  DispatchPreviewData,
} from "@/app/[supabaseId]/email/campanhas/features/components/analytics/AnalyticsTypes"
import type { ContactList as ContatoList, Contact } from "@/app/[supabaseId]/email/contatos/features/context/ContatosTypes"
import type {
  BlockedDateRange,
  DomainConnectResult,
  DomainRecord,
  EmailGlobalVariable,
  EmailSender,
  EmailSettings,
  EmailVariableType,
  EmailVariableValueSource,
  ResendDomainStatus,
} from "@/app/[supabaseId]/email/configuracoes/features/context/EmailSettingsTypes"
import type { EmailLog, LogDetail } from "@/app/[supabaseId]/email/historico/features/context/HistoricoTypes"
import type { Template } from "@/app/[supabaseId]/email/templates/features/context/TemplatesTypes"
import type {
  Template as EditorTemplate,
  TemplateEditorDraft,
  TemplateTestRequest,
  TemplateVersionItem,
} from "@/app/[supabaseId]/email/templates/[id]/features/context/TemplateEditorTypes"
import type { EmailTemplateAssetItem } from "@/lib/email/email-template-assets"
import type { EmailContactImportRow } from "@/lib/emailContactImport/emailContactImportFields"

export type StudioEmailCreateCampaignData = {
  name: string
  templateId: string
  contactListId?: string
  contactListIds?: string[]
  listStrategy?: "single" | "merge" | "per_list"
  radarSegmentSlug?: string
  scheduledAt?: string
  scheduleIntervalDays?: number
  uniformSchedule?: boolean
  subCampaignSchedules?: Array<{ index: number; scheduledAt: string }>
}

export type StudioEmailUpdateCampaignData = {
  name?: string
  templateId?: string
  contactListId?: string
  contactListIds?: string[]
  listStrategy?: "single" | "merge" | "per_list"
  radarSegmentSlug?: string
  scheduledAt?: string | null
}

export type StudioEmailListCampaignsResult = {
  campaigns: Campaign[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type StudioEmailSendResult = {
  campaignId: string
  dispatchId: string
  totalRecipients: number
  status: "sending"
}

export interface StudioEmailCampanhasService {
  list(
    supabaseId: string,
    teamId: string | null | undefined,
    page: number,
    pageSize: number,
    status?: string[],
    name?: string,
    createdAtFrom?: string,
    createdAtTo?: string
  ): Promise<StudioEmailListCampaignsResult>
  create(
    supabaseId: string,
    teamId: string | null | undefined,
    data: StudioEmailCreateCampaignData
  ): Promise<Campaign>
  previewPlan(
    supabaseId: string,
    teamId: string | null | undefined,
    data: StudioEmailCreateCampaignData
  ): Promise<import("@/app/[supabaseId]/email/campanhas/features/context/CampanhasTypes").CampaignPreviewPlan>
  getById(supabaseId: string, teamId: string | null | undefined, id: string): Promise<Campaign>
  update(
    supabaseId: string,
    teamId: string | null | undefined,
    id: string,
    data: StudioEmailUpdateCampaignData
  ): Promise<Campaign>
  send(supabaseId: string, teamId: string | null | undefined, id: string): Promise<StudioEmailSendResult>
  cancel(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  deleteDraft(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  archive(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  getCreditStatus(supabaseId: string, teamId: string | null | undefined): Promise<CreditStatus>
  getTemplates(supabaseId: string, teamId: string | null | undefined): Promise<CampaignTemplate[]>
  getContactLists(supabaseId: string, teamId: string | null | undefined): Promise<ContactList[]>
  getCampaignLogs(
    supabaseId: string,
    teamId: string | null | undefined,
    campaignId: string,
    params: { page: number; pageSize: number; search?: string; status?: string[] }
  ): Promise<{
    logs: CampaignEmailLog[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
  getCampaignLogDetail(
    supabaseId: string,
    teamId: string | null | undefined,
    logId: string
  ): Promise<CampaignLogDetail>
}

export type StudioEmailCreateListData = { name: string; description?: string }

export type StudioEmailGetContactsResult = {
  contacts: Contact[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type StudioEmailUploadCsvResult = {
  imported: number
  updated: number
  total: number
}

export type StudioEmailContactImportEnqueueResult = {
  importId: string
}

export interface StudioEmailContatosService {
  getLists(): Promise<ContatoList[]>
  createList(data: StudioEmailCreateListData): Promise<ContatoList>
  deleteList(id: string): Promise<void>
  getContacts(
    listId: string,
    page: number,
    pageSize: number,
    search: string
  ): Promise<StudioEmailGetContactsResult>
  uploadCsv(listId: string, file: File): Promise<StudioEmailUploadCsvResult>
  importMapped(listId: string, rows: EmailContactImportRow[]): Promise<StudioEmailContactImportEnqueueResult>
  deleteContact(listId: string, contactId: string): Promise<void>
  addContact(listId: string, email: string, name?: string): Promise<void>
  setListRadarSegment(listId: string, segmentId: string | null): Promise<void>
}

export type StudioEmailCreateTemplateData = {
  name: string
  subject: string
  previewText?: string
  mailyJson?: unknown
  html?: string
}

export interface StudioEmailTemplatesService {
  getApprovalSettings(
    supabaseId: string,
    teamId?: string | null
  ): Promise<{ templateApprovalRequired: boolean }>
  list(supabaseId: string, teamId?: string | null): Promise<Template[]>
  create(supabaseId: string, data: StudioEmailCreateTemplateData, teamId?: string | null): Promise<Template>
  delete(supabaseId: string, id: string, teamId?: string | null): Promise<void>
  submitForApproval(supabaseId: string, id: string, teamId?: string | null): Promise<Template>
  approve(supabaseId: string, id: string, teamId?: string | null): Promise<Template>
  reject(supabaseId: string, id: string, reviewNote: string, teamId?: string | null): Promise<Template>
}

export type StudioEmailUpdateSettingsData = {
  dispatchBlockedDates?: BlockedDateRange[] | null
  dispatchTimeFrom?: string | null
  dispatchTimeTo?: string | null
  dispatchAllowedRoles?: string[]
  templateCreateRoles?: string[]
  templateApprovalRequired?: boolean
  templateApprovalRoles?: string[]
  blockedDispatchDays?: number[] | null
}

export type StudioEmailUpsertSenderData = {
  name: string
  email: string
  replyTo?: string | null
}

export type StudioEmailUpsertVariableData = {
  key: string
  type?: EmailVariableType
  defaultValue?: string | null
  description?: string | null
  isActive?: boolean
  valueSource?: EmailVariableValueSource
  radarFieldKey?: string | null
}

export interface StudioEmailSettingsService {
  get(): Promise<EmailSettings>
  update(data: StudioEmailUpdateSettingsData): Promise<EmailSettings>
  getSenders(): Promise<EmailSender[]>
  createSender(data: StudioEmailUpsertSenderData): Promise<EmailSender>
  updateSender(senderId: string, data: StudioEmailUpsertSenderData): Promise<EmailSender>
  deleteSender(senderId: string): Promise<void>
  setDefaultSender(senderId: string): Promise<EmailSettings>
  connectDomain(domainName: string): Promise<DomainConnectResult>
  disconnectDomain(): Promise<void>
  verifyDomain(): Promise<{ status: ResendDomainStatus }>
  getDomainRecords(): Promise<DomainConnectResult>
  getVariables(): Promise<EmailGlobalVariable[]>
  createVariable(data: StudioEmailUpsertVariableData): Promise<EmailGlobalVariable>
  updateVariable(variableId: string, data: StudioEmailUpsertVariableData): Promise<EmailGlobalVariable>
  deleteVariable(variableId: string): Promise<void>
}

export type StudioEmailHistoricoListParams = {
  page: number
  pageSize: number
  search?: string
  status?: string
  category?: string
  from?: string
  to?: string
}

export type StudioEmailHistoricoListResult = {
  logs: EmailLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface StudioEmailHistoricoService {
  getLogs(params: StudioEmailHistoricoListParams): Promise<StudioEmailHistoricoListResult>
  getLogDetail(logId: string): Promise<LogDetail>
}

export interface StudioEmailCampaignAnalyticsService {
  getAnalytics(period: AnalyticsPeriod, timezone: string, campaignId?: string): Promise<AnalyticsData>
  getDispatchPreview(campaignId: string, dispatchId: string): Promise<DispatchPreviewData>
}

export type StudioEmailTemplateAssetUploadResult = {
  fileId: string
  fileName: string
  publicUrl: string
}

export type StudioEmailXPostEmbedResult = {
  authorName: string
  authorUrl: string | null
  text: string
  postUrl: string
  htmlSnippet: string
}

export interface StudioEmailTemplateEditorService {
  getApprovalSettings(
    supabaseId: string,
    teamId?: string | null
  ): Promise<{ templateApprovalRequired: boolean }>
  getEmailSettingsForTips(
    supabaseId: string,
    teamId?: string | null
  ): Promise<{ fromEmail: string | null }>
  getTemplate(supabaseId: string, templateId: string, teamId?: string | null): Promise<EditorTemplate>
  createTemplate(
    supabaseId: string,
    draft: TemplateEditorDraft,
    teamId?: string | null
  ): Promise<EditorTemplate>
  updateTemplate(
    supabaseId: string,
    templateId: string,
    draft: TemplateEditorDraft,
    teamId?: string | null
  ): Promise<EditorTemplate>
  publishTemplate(supabaseId: string, templateId: string, teamId?: string | null): Promise<EditorTemplate>
  unpublishTemplate(supabaseId: string, templateId: string, teamId?: string | null): Promise<EditorTemplate>
  submitForApproval(supabaseId: string, templateId: string, teamId?: string | null): Promise<EditorTemplate>
  approveTemplate(supabaseId: string, templateId: string, teamId?: string | null): Promise<EditorTemplate>
  rejectTemplate(
    supabaseId: string,
    templateId: string,
    reviewNote: string,
    teamId?: string | null
  ): Promise<EditorTemplate>
  sendTest(
    supabaseId: string,
    templateId: string,
    teamId: string | null | undefined,
    input: TemplateTestRequest
  ): Promise<void>
  listVersions(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<{ versions: TemplateVersionItem[] }>
  restoreVersion(
    supabaseId: string,
    templateId: string,
    versionId: string,
    teamId?: string | null
  ): Promise<EditorTemplate>
  listAssets(supabaseId: string, teamId?: string | null): Promise<{ assets: EmailTemplateAssetItem[] }>
  uploadAsset(
    supabaseId: string,
    teamId: string | null | undefined,
    file: File
  ): Promise<StudioEmailTemplateAssetUploadResult>
  deleteAsset(supabaseId: string, teamId: string | null | undefined, fileId: string): Promise<void>
  resolveXPostEmbed(
    supabaseId: string,
    teamId: string | null | undefined,
    url: string
  ): Promise<StudioEmailXPostEmbedResult>
}

export type {
  BlockedDateRange,
  DomainConnectResult,
  DomainRecord,
  EmailGlobalVariable,
  EmailSender,
  EmailSettings,
  ResendDomainStatus,
}
