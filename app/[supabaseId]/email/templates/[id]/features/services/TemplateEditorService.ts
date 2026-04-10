import { Template } from '../context/TemplateEditorTypes'

export interface CreateTemplateData {
  name: string
  subject: string
  previewText?: string
  mailyJson?: unknown
  html?: string
}

export interface UpdateTemplateData {
  name?: string
  subject?: string
  previewText?: string
  mailyJson?: unknown
  html?: string
}

export interface ITemplateEditorService {
  getById(id: string): Promise<Template>
  create(data: CreateTemplateData): Promise<Template>
  update(id: string, data: UpdateTemplateData): Promise<Template>
}

export class TemplateEditorService implements ITemplateEditorService {
  private readonly baseUrl = '/api/v1/email/templates'

  async getById(id: string): Promise<Template> {
    console.info('[TemplateEditorService] Fetching template', id)
    const response = await fetch(`${this.baseUrl}/${id}`, { cache: 'no-store' })

    if (!response.ok) {
      const message = `Erro ao buscar template: ${response.status}`
      console.error('[TemplateEditorService]', message)
      throw new Error(message)
    }

    const body = await response.json() as { isValid: boolean; result: Template }

    if (!body.isValid) {
      const message = 'Resposta inválida ao buscar template'
      console.error('[TemplateEditorService]', message)
      throw new Error(message)
    }

    return body.result
  }

  async create(data: CreateTemplateData): Promise<Template> {
    console.info('[TemplateEditorService] Creating template', data.name)
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const message = `Erro ao criar template: ${response.status}`
      console.error('[TemplateEditorService]', message)
      throw new Error(message)
    }

    const body = await response.json() as { isValid: boolean; result: Template }

    if (!body.isValid) {
      const message = 'Resposta inválida ao criar template'
      console.error('[TemplateEditorService]', message)
      throw new Error(message)
    }

    return body.result
  }

  async update(id: string, data: UpdateTemplateData): Promise<Template> {
    console.info('[TemplateEditorService] Updating template', id)
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const message = `Erro ao atualizar template: ${response.status}`
      console.error('[TemplateEditorService]', message)
      throw new Error(message)
    }

    const body = await response.json() as { isValid: boolean; result: Template }

    if (!body.isValid) {
      const message = 'Resposta inválida ao atualizar template'
      console.error('[TemplateEditorService]', message)
      throw new Error(message)
    }

    return body.result
  }
}

export function createTemplateEditorService(): ITemplateEditorService {
  return new TemplateEditorService()
}
