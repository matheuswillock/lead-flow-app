import type { ITemplatePickerService, TemplateContent, TemplatePickerItem } from './ITemplatePickerService'

interface OutputResponse<T> {
  isValid: boolean
  errorMessages?: string[]
  result: T
}

export class TemplatePickerService implements ITemplatePickerService {
  private readonly baseUrl = '/api/v1/email/templates'

  async listTemplates(_teamId: string): Promise<TemplatePickerItem[]> {
    console.info('[TemplatePickerService] Listing templates')

    const response = await fetch(this.baseUrl, { cache: 'no-store' })
    const body = (await response.json().catch(() => null)) as OutputResponse<TemplatePickerItem[]> | null

    if (!response.ok || !body?.isValid) {
      const message =
        body?.errorMessages?.[0] ??
        `Erro ao listar templates: ${response.status}`
      console.error('[TemplatePickerService] Failed to list templates', message)
      throw new Error(message)
    }

    return Array.isArray(body.result) ? body.result : []
  }

  async getTemplateContent(id: string): Promise<TemplateContent> {
    console.info('[TemplatePickerService] Fetching template content', id)

    const response = await fetch(`${this.baseUrl}/${id}`, { cache: 'no-store' })
    const body = (await response.json().catch(() => null)) as OutputResponse<TemplateContent> | null

    if (!response.ok || !body?.isValid || !body.result) {
      const message =
        body?.errorMessages?.[0] ??
        `Erro ao carregar template: ${response.status}`
      console.error('[TemplatePickerService] Failed to fetch template content', message)
      throw new Error(message)
    }

    return body.result
  }
}

export const templatePickerService = new TemplatePickerService()
