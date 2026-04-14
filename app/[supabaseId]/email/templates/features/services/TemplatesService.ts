import { Template } from '../context/TemplatesTypes'

export interface CreateTemplateData {
  name: string
  subject: string
  previewText?: string
  mailyJson?: unknown
  html?: string
}

export interface ITemplatesService {
  list(supabaseId: string): Promise<Template[]>
  create(supabaseId: string, data: CreateTemplateData): Promise<Template>
  delete(supabaseId: string, id: string): Promise<void>
}

export class TemplatesService implements ITemplatesService {
  private readonly baseUrl = '/api/v1/email/templates'

  async list(_supabaseId: string): Promise<Template[]> {
    console.info('[TemplatesService] Fetching templates list')
    const response = await fetch(this.baseUrl, { cache: 'no-store' })

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

  async create(_supabaseId: string, data: CreateTemplateData): Promise<Template> {
    console.info('[TemplatesService] Creating template', data.name)
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  async delete(_supabaseId: string, id: string): Promise<void> {
    console.info('[TemplatesService] Deleting template', id)
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
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
