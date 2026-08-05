import type { PublicFormDraftInput } from "@/lib/public-forms/types"

export type StudioPublicFormListItem = {
  id: string
  name: string
  publicId: string
  status: "draft" | "published" | "archived"
  approvalStatus: "draft" | "pending_approval" | "approved" | "rejected"
  assignedSdr: { id: string; fullName: string | null } | null
  updatedAt: string
  _count: { submissions: number }
  publications: Array<{ id: string; version: number }>
  managedByCorretorStudio?: boolean
}

export type StudioPublicFormsPage = {
  items: StudioPublicFormListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  capabilities: { canEdit: boolean; canApprove: boolean }
}

export type StudioPublicFormSettings = {
  approvalRequired: boolean
  approverRoles: Array<"manager" | "backoffice" | "operator">
  defaultBackgroundColor: string
  defaultTextColor: string
  defaultLineColor: string
  defaultAccentColor: string
  defaultButtonTextColor: string
  defaultInputBackgroundColor: string
}

export type StudioPublicFormDetail = PublicFormDraftInput &
  StudioPublicFormListItem & {
    capabilities: { canEdit: boolean; canApprove: boolean }
    managedByCorretorStudio?: boolean
    eligibleClosers: Array<{
      profileId: string
      profile: { id: string; fullName: string | null; email: string | null }
    }>
  }

export type StudioPublicFormAnalytics = {
  publications: Array<{
    id: string
    version: number
    publishedAt: string
    endedAt: string | null
    questions: Array<{ id: string; title: string; position: number }>
  }>
  events: Array<{
    eventType: string
    publicationId: string
    questionId: string | null
    _count: { _all: number }
  }>
  origins: Array<{ source: string; sessions: number }>
}

export type StudioPublicFormWizardContext = {
  members: Array<{ profileId: string; name: string; functions: Array<"SDR" | "CLOSER"> }>
  customFields: Array<{
    id: string
    key: string
    label: string
    type: string
    isActive: boolean
    options: unknown
  }>
  healthPlans: Array<{ id: string; name: string }>
  settings: StudioPublicFormSettings
}

export type StudioPublicFormsListFilters = {
  search?: string
  status?: string[]
  approvalStatus?: string[]
  page?: number
  pageSize?: number
}

export interface IBackofficeStudioPublicFormsService {
  list(
    masterId: string,
    teamId: string,
    filters?: StudioPublicFormsListFilters
  ): Promise<StudioPublicFormsPage>
  get(masterId: string, teamId: string, formId: string): Promise<StudioPublicFormDetail>
  create(
    masterId: string,
    teamId: string,
    input: PublicFormDraftInput
  ): Promise<StudioPublicFormDetail>
  update(
    masterId: string,
    teamId: string,
    formId: string,
    input: PublicFormDraftInput
  ): Promise<StudioPublicFormDetail>
  action(
    masterId: string,
    teamId: string,
    formId: string,
    action: string,
    body?: unknown
  ): Promise<unknown>
  getSettings(masterId: string, teamId: string): Promise<StudioPublicFormSettings>
  saveSettings(
    masterId: string,
    teamId: string,
    input: StudioPublicFormSettings
  ): Promise<StudioPublicFormSettings>
  analytics(
    masterId: string,
    teamId: string,
    formId: string,
    filters?: { from?: string; to?: string; publicationId?: string }
  ): Promise<StudioPublicFormAnalytics>
  getWizardContext(masterId: string, teamId: string): Promise<StudioPublicFormWizardContext>
  getTemplate(
    masterId: string,
    teamId: string,
    slug: string
  ): Promise<{
    slug: string
    name: string
    description: string | null
    formKind: string
    draft: PublicFormDraftInput
  }>
}
