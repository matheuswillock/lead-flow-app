import type { Template } from '../context/TemplatesTypes'
import type { CreateTemplateData, ITemplatesService } from './ITemplatesService'
import { API_CLIENT_BASE } from "@/lib/route-map";

class TemplatesService implements ITemplatesService {
  private readonly baseUrl = `${API_CLIENT_BASE}/email/templates`
  private readonly settingsUrl = `${API_CLIENT_BASE}/email/settings`

  private buildHeaders(supabaseId: string, teamId?: string | null): HeadersInit {
    return {
      'x-supabase-user-id': supabaseId,
      ...(teamId ? { 'x-team-id': teamId } : {}),
    }
  }

  private async parseJson<T>(response: Response, fallback: string): Promise<T> {
    const body = await response.json().catch(() => null) as { isValid: boolean; result: T; errorMessages?: string[] } | null
    if (!response.ok || !body?.isValid) {
      throw new Error(body?.errorMessages?.join(', ') || fallback)
    }
    return body.result
  }

  async list(supabaseId: string, teamId?: string | null): Promise<Template[]> {
    console.info('[TemplatesService] Fetching templates list')
    const response = await fetch(this.baseUrl, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return this.parseJson<Template[]>(response, 'Erro ao buscar templates')
  }

  async getApprovalSettings(supabaseId: string, teamId?: string | null): Promise<{ templateApprovalRequired: boolean }> {
    const response = await fetch(this.settingsUrl, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const settings = await this.parseJson<{ templateApprovalRequired?: boolean }>(
      response,
      'Erro ao buscar configurações de aprovação'
    )
    return { templateApprovalRequired: settings.templateApprovalRequired ?? false }
  }

  async create(supabaseId: string, data: CreateTemplateData, teamId?: string | null): Promise<Template> {
    console.info('[TemplatesService] Creating template', data.name)
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.buildHeaders(supabaseId, teamId) },
      body: JSON.stringify(data),
    })
    return this.parseJson<Template>(response, 'Erro ao criar template')
  }

  async delete(supabaseId: string, id: string, teamId?: string | null): Promise<void> {
    console.info('[TemplatesService] Deleting template', id)
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    if (!response.ok) {
      throw new Error(`Erro ao excluir template: ${response.status}`)
    }
  }

  async submitForApproval(supabaseId: string, id: string, teamId?: string | null): Promise<Template> {
    console.info('[TemplatesService] Submitting template for approval', id)
    const response = await fetch(`${this.baseUrl}/${id}/submit`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return this.parseJson<Template>(response, 'Erro ao enviar template para aprovação')
  }

  async approve(supabaseId: string, id: string, teamId?: string | null): Promise<Template> {
    console.info('[TemplatesService] Approving template', id)
    const response = await fetch(`${this.baseUrl}/${id}/approve`, {
      method: 'POST',
      headers: this.buildHeaders(supabaseId, teamId),
    })
    return this.parseJson<Template>(response, 'Erro ao aprovar template')
  }

  async reject(supabaseId: string, id: string, reviewNote: string, teamId?: string | null): Promise<Template> {
    console.info('[TemplatesService] Rejecting template', id)
    const response = await fetch(`${this.baseUrl}/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.buildHeaders(supabaseId, teamId) },
      body: JSON.stringify({ reviewNote }),
    })
    return this.parseJson<Template>(response, 'Erro ao recusar template')
  }
}

export function createTemplatesService(): ITemplatesService {
  return new TemplatesService()
}
