import type { Campaign, CreditStatus, Template, ContactList, CampaignEmailLog, CampaignLogDetail, CampaignPreviewPlan } from '../context/CampanhasTypes'
import { API_CLIENT_BASE } from "@/lib/route-map";

export type CampaignWritePayload = {
  name: string
  description?: string | null
  templateId: string
  contactListId?: string
  contactListIds?: string[]
  listStrategy?: "single" | "merge" | "per_list"
  radarSegmentSlug?: string
  saveAsRadarSegment?: boolean
  saveAsRadarSegmentName?: string | null
  scheduledAt?: string
  scheduleIntervalDays?: number
  uniformSchedule?: boolean
  subCampaignSchedules?: Array<{ index: number; scheduledAt: string }>
  subCampaignTemplates?: Array<{ index: number; templateId: string }>
}

export interface ICampanhasService {
  list(supabaseId: string, teamId: string | null | undefined, page: number, pageSize: number, status?: string[], name?: string, createdAtFrom?: string, createdAtTo?: string): Promise<{ campaigns: Campaign[]; total: number; page: number; pageSize: number; totalPages: number }>
  create(supabaseId: string, teamId: string | null | undefined, data: CampaignWritePayload): Promise<Campaign>
  previewPlan(supabaseId: string, teamId: string | null | undefined, data: CampaignWritePayload): Promise<CampaignPreviewPlan>
  getById(supabaseId: string, teamId: string | null | undefined, id: string): Promise<Campaign>
  send(supabaseId: string, teamId: string | null | undefined, id: string, options?: { retryFailedOnly?: boolean }): Promise<{
    campaignId: string
    dispatchId: string
    totalRecipients: number
    retryFailedOnly?: boolean
    status: "sending"
  }>
  cancel(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  deleteDraft(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  archive(supabaseId: string, teamId: string | null | undefined, id: string): Promise<void>
  update(supabaseId: string, teamId: string | null | undefined, id: string, data: Partial<CampaignWritePayload> & {
    subCampaignUpdates?: Array<{
      id: string
      name?: string
      scheduledAt?: string | null
      contactListId?: string
      templateId?: string
    }>
  }): Promise<Campaign>
  getCreditStatus(supabaseId: string, teamId: string | null | undefined): Promise<CreditStatus>
  getTemplates(supabaseId: string, teamId: string | null | undefined): Promise<Template[]>
  getTemplateById(supabaseId: string, teamId: string | null | undefined, id: string): Promise<Template>
  getContactLists(supabaseId: string, teamId: string | null | undefined): Promise<ContactList[]>
  getCampaignLogs(supabaseId: string, teamId: string | null | undefined, campaignId: string, params: { page: number; pageSize: number; search?: string; status?: string[] }): Promise<{ logs: CampaignEmailLog[]; total: number; page: number; pageSize: number; totalPages: number }>
  getCampaignLogDetail(supabaseId: string, teamId: string | null | undefined, logId: string): Promise<CampaignLogDetail>
}

export class CampanhasService implements ICampanhasService {
  private readonly baseUrl = `${API_CLIENT_BASE}/email`

  private buildHeaders(supabaseId: string, teamId?: string | null): HeadersInit {
    return {
      'x-supabase-user-id': supabaseId,
      ...(teamId ? { 'x-team-id': teamId } : {}),
    }
  }

  async list(supabaseId: string, teamId: string | null | undefined, page: number, pageSize: number, status?: string[], name?: string, createdAtFrom?: string, createdAtTo?: string) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (status && status.length > 0) params.set('status', status.join(','))
    if (name) params.set('name', name)
    if (createdAtFrom) params.set('createdAtFrom', createdAtFrom)
    if (createdAtTo) params.set('createdAtTo', createdAtTo)
    const res = await fetch(`${this.baseUrl}/campaigns?${params}`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as { campaigns: Campaign[]; total: number; page: number; pageSize: number; totalPages: number }
  }

  async create(supabaseId: string, teamId: string | null | undefined, data: CampaignWritePayload) {
    const res = await fetch(`${this.baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.buildHeaders(supabaseId, teamId) },
      body: JSON.stringify(data),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as Campaign
  }

  async previewPlan(supabaseId: string, teamId: string | null | undefined, data: CampaignWritePayload) {
    const res = await fetch(`${this.baseUrl}/campaigns/preview-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.buildHeaders(supabaseId, teamId) },
      body: JSON.stringify(data),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as CampaignPreviewPlan
  }

  async getById(supabaseId: string, teamId: string | null | undefined, id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as Campaign
  }

  async send(
    supabaseId: string,
    teamId: string | null | undefined,
    id: string,
    options?: { retryFailedOnly?: boolean }
  ) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.buildHeaders(supabaseId, teamId) },
      body: JSON.stringify({
        ...(options?.retryFailedOnly ? { retryFailedOnly: true } : {}),
      }),
    })
    const json = await res.json().catch(() => null)
    // 202 Accepted conta como sucesso (res.ok === true)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json?.isValid) throw new Error(json?.errorMessages?.join(', ') ?? 'Erro')
    return json.result as {
      campaignId: string
      dispatchId: string
      totalRecipients: number
      retryFailedOnly?: boolean
      status: "sending"
    }
  }

  async cancel(supabaseId: string, teamId: string | null | undefined, id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}/cancel`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
  }

  async update(supabaseId: string, teamId: string | null | undefined, id: string, data: Partial<CampaignWritePayload> & {
    subCampaignUpdates?: Array<{
      id: string
      name?: string
      scheduledAt?: string | null
      contactListId?: string
      templateId?: string
    }>
  }) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.buildHeaders(supabaseId, teamId) },
      body: JSON.stringify(data),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as Campaign
  }

  async deleteDraft(supabaseId: string, teamId: string | null | undefined, id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}`, {
      method: 'DELETE',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
  }

  async archive(supabaseId: string, teamId: string | null | undefined, id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}/archive`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
  }

  async getCreditStatus(supabaseId: string, teamId: string | null | undefined) {
    const res = await fetch(`${this.baseUrl}/credits/status`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as CreditStatus
  }

  async getTemplates(supabaseId: string, teamId: string | null | undefined) {
    const res = await fetch(`${this.baseUrl}/templates?scope=campaign`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return ((json.result ?? []) as Template[]).filter((t) => t.status === 'published' && t.isCurrentPublished)
  }

  async getTemplateById(supabaseId: string, teamId: string | null | undefined, id: string) {
    const res = await fetch(`${this.baseUrl}/templates/${id}`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as Template
  }

  async getContactLists(supabaseId: string, teamId: string | null | undefined) {
    const res = await fetch(`${this.baseUrl}/contact-lists`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return (json.result ?? []) as ContactList[]
  }

  async getCampaignLogs(
    supabaseId: string,
    teamId: string | null | undefined,
    campaignId: string,
    params: { page: number; pageSize: number; search?: string; status?: string[] },
  ) {
    const query = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
      campaignId,
    })
    if (params.search) query.set('search', params.search)
    if (params.status && params.status.length > 0) query.set('status', params.status.join(','))
    const res = await fetch(`${this.baseUrl}/logs?${query}`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as { logs: CampaignEmailLog[]; total: number; page: number; pageSize: number; totalPages: number }
  }

  async getCampaignLogDetail(supabaseId: string, teamId: string | null | undefined, logId: string) {
    const res = await fetch(`${this.baseUrl}/logs/${logId}`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`)
    if (!json.isValid) throw new Error(json.errorMessages?.join(', ') ?? 'Erro')
    return json.result as CampaignLogDetail
  }
}
