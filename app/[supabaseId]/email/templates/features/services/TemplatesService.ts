import { Template } from '../context/TemplatesTypes'

export interface CreateTemplateData {
  name: string
  subject: string
  previewText?: string
  mailyJson?: unknown
  html?: string
}

export interface ITemplatesService {
  list(supabaseId: string, teamId?: string | null): Promise<Template[]>
  create(supabaseId: string, data: CreateTemplateData, teamId?: string | null): Promise<Template>
  delete(supabaseId: string, id: string, teamId?: string | null): Promise<void>
}

export class TemplatesService implements ITemplatesService {
  private readonly baseUrl = '/api/v1/email/templates'

  private buildHeaders(supabaseId: string, teamId?: string | null): HeadersInit {
    return {
      'x-supabase-user-id': supabaseId,
      ...(teamId ? { 'x-team-id': teamId } : {}),
    }
  }

  async list(supabaseId: string, teamId?: string | null): Promise<Template[]> {
    console.info('[TemplatesService] Fetching templates list')
    const response = await fetch(this.baseUrl, {
      cache: 'no-store',
      headers: this.buildHeaders(supabaseId, teamId),
    })

    if (!response.ok) {
      const message = `Erro ao buscar templates: ${response.status}`
      console.error('[TemplatesService]', message)
      throw new Error(message)
    }

    const body = await response.json() as { isValid: boolean; result: Template[] }

    if (!body.isValid) {
      const message = 'Resposta inválida ao buscar templates'
      console.error('[TemplatesService]', message)
      throw new Error(message)
    }

    return body.result
  }

  async create(supabaseId: string, data: CreateTemplateData, teamId?: string | null): Promise<Template> {
    console.info('[TemplatesService] Creating template', data.name)
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildHeaders(supabaseId, teamId),
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const message = `Erro ao criar template: ${response.status}`
      console.error('[TemplatesService]', message)
      throw new Error(message)
    }

    const body = await response.json() as { isValid: boolean; result: Template }

    if (!body.isValid) {
      const message = 'Resposta inválida ao criar template'
      console.error('[TemplatesService]', message)
      throw new Error(message)
    }

    return body.result
  }

  async delete(supabaseId: string, id: string, teamId?: string | null): Promise<void> {
    console.info('[TemplatesService] Deleting template', id)
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: this.buildHeaders(supabaseId, teamId),
    })

    if (!response.ok) {
      const message = `Erro ao excluir template: ${response.status}`
      console.error('[TemplatesService]', message)
      throw new Error(message)
    }
  }
}

export function createTemplatesService(): ITemplatesService {
  return new TemplatesService()
}
