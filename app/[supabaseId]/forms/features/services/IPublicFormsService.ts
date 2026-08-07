import type {
  PublicFormDetail,
  PublicFormsIds,
  PublicFormsPage,
  PublicFormSettings,
  RankedForm,
} from "../context/PublicFormsTypes"
import type { PublicFormDraftInput } from "@/lib/public-forms/types"

export interface PublicFormsListFilters {
  search: string
  status: string[]
  approvalStatus: string[]
  assignedSdrId?: string
  updatedFrom?: string
  updatedTo?: string
  page: number
  pageSize: number
}

export interface PublicFormAnalytics {
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
  totals: {
    views: number
    starts: number
    completions: number
    leadCreatedSessions: number
    leadAttachedSessions: number
    meetings: number
    uniqueLeads: number
  }
  origins: Array<{ source: string; sessions: number }>
}

export type PublicFormTemplateListItem = {
  id: string
  slug: string
  name: string
  description: string | null
  formKind: string
  sortOrder: number
}

export type PublicFormTemplateDetail = PublicFormTemplateListItem & {
  draft: PublicFormDraftInput
}

export interface IPublicFormsService {
  list(ids: PublicFormsIds, filters: PublicFormsListFilters): Promise<PublicFormsPage>
  listTemplates(ids: PublicFormsIds): Promise<PublicFormTemplateListItem[]>
  getTemplate(ids: PublicFormsIds, slug: string): Promise<PublicFormTemplateDetail>
  get(ids: PublicFormsIds, formId: string): Promise<PublicFormDetail>
  create(ids: PublicFormsIds, input: PublicFormDraftInput): Promise<PublicFormDetail>
  update(ids: PublicFormsIds, formId: string, input: PublicFormDraftInput): Promise<PublicFormDetail>
  action(ids: PublicFormsIds, formId: string, action: string, body?: unknown): Promise<unknown>
  getSettings(ids: PublicFormsIds): Promise<PublicFormSettings>
  saveSettings(ids: PublicFormsIds, input: PublicFormSettings): Promise<PublicFormSettings>
  analytics(
    ids: PublicFormsIds,
    formId: string,
    filters?: { from?: string; to?: string; publicationId?: string },
  ): Promise<PublicFormAnalytics>
  topConverting(ids: PublicFormsIds): Promise<{ items: RankedForm[] }>
}
