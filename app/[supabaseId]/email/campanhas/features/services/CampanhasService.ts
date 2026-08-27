import type { Campaign, CreditStatus, Template, ContactList, CampaignEmailLog, CampaignLogDetail, CampaignPreviewPlan } from '../context/CampanhasTypes'
import { API_CLIENT_BASE } from "@/lib/route-map";
import { ApiRequestError } from "@/lib/http/api-request-error";

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

  /**
   * Único ponto de leitura de resposta HTTP do módulo de e-mail. Erro de rota
   * nossa (HTTP não-2xx ou Output.isValid:false) vira `ApiRequestError` — a
   * mensagem já é copy de produto (Output.errorMessages) e chega etiquetada
   * até o toast, em vez de um `Error` genérico que força `toUserToastMessage`
   * a adivinhar a origem pela string (regressão Calli, 2026-08-27: mensagem
   * sem acento era mascarada como "Ocorreu um erro.").
   */
  private async parseCampaignsResponse<T>(res: Response): Promise<T> {
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new ApiRequestError(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`, res.status)
    }
    if (!json?.isValid) {
      throw new ApiRequestError(json?.errorMessages?.join(', ') ?? 'Erro', res.status)
    }
    return json.result as T
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
    return this.parseCampaignsResponse<{ campaigns: Campaign[]; total: number; page: number; pageSize: number; totalPages: number }>(res)
  }

  async create(supabaseId: string, teamId: string | null | undefined, data: CampaignWritePayload) {
    const res = await fetch(`${this.baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.buildHeaders(supabaseId, teamId) },
      body: JSON.stringify(data),
    })
    return this.parseCampaignsResponse<Campaign>(res)
  }

  async previewPlan(supabaseId: string, teamId: string | null | undefined, data: CampaignWritePayload) {
    const res = await fetch(`${this.baseUrl}/campaigns/preview-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.buildHeaders(supabaseId, teamId) },
      body: JSON.stringify(data),
    })
    return this.parseCampaignsResponse<CampaignPreviewPlan>(res)
  }

  async getById(supabaseId: string, teamId: string | null | undefined, id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return this.parseCampaignsResponse<Campaign>(res)
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
    // 202 Accepted conta como sucesso (res.ok === true)
    return this.parseCampaignsResponse<{
      campaignId: string
      dispatchId: string
      totalRecipients: number
      retryFailedOnly?: boolean
      status: "sending"
    }>(res)
  }

  async cancel(supabaseId: string, teamId: string | null | undefined, id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}/cancel`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    await this.parseCampaignsResponse<void>(res)
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
    return this.parseCampaignsResponse<Campaign>(res)
  }

  async deleteDraft(supabaseId: string, teamId: string | null | undefined, id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}`, {
      method: 'DELETE',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      throw new ApiRequestError(json?.errorMessages?.join(', ') ?? `HTTP ${res.status}`, res.status)
    }
  }

  async archive(supabaseId: string, teamId: string | null | undefined, id: string) {
    const res = await fetch(`${this.baseUrl}/campaigns/${id}/archive`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    await this.parseCampaignsResponse<void>(res)
  }

  async getCreditStatus(supabaseId: string, teamId: string | null | undefined) {
    const res = await fetch(`${this.baseUrl}/credits/status`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return this.parseCampaignsResponse<CreditStatus>(res)
  }

  async getTemplates(supabaseId: string, teamId: string | null | undefined) {
    const res = await fetch(`${this.baseUrl}/templates?scope=campaign`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const templates = await this.parseCampaignsResponse<Template[] | undefined>(res)
    return (templates ?? []).filter((t) => t.status === 'published' && t.isCurrentPublished)
  }

  async getTemplateById(supabaseId: string, teamId: string | null | undefined, id: string) {
    const res = await fetch(`${this.baseUrl}/templates/${id}`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return this.parseCampaignsResponse<Template>(res)
  }

  async getContactLists(supabaseId: string, teamId: string | null | undefined) {
    const res = await fetch(`${this.baseUrl}/contact-lists`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const lists = await this.parseCampaignsResponse<ContactList[] | undefined>(res)
    return lists ?? []
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
    return this.parseCampaignsResponse<{ logs: CampaignEmailLog[]; total: number; page: number; pageSize: number; totalPages: number }>(res)
  }

  async getCampaignLogDetail(supabaseId: string, teamId: string | null | undefined, logId: string) {
    const res = await fetch(`${this.baseUrl}/logs/${logId}`, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return this.parseCampaignsResponse<CampaignLogDetail>(res)
  }
}
