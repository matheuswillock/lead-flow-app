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
    questions: Array<{
      id: string
      title: string
      position: number
      /** Identidade estável da pergunta; junta com `events[].questionKey`. */
      questionKey: string | null
    }>
  }>
  events: Array<{
    eventType: string
    publicationId: string
    questionId: string | null
    /**
     * Chave de junção imune a delete/recriação da pergunta. `questionId` fica
     * NULL nos eventos órfãos (FK `SetNull`), então casar por id perdia
     * respostas que existem de verdade.
     */
    questionKey: string | null
    /** Sessões únicas. */
    uniqueSessions: number
    /** @deprecated Alias de `uniqueSessions`. */
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
