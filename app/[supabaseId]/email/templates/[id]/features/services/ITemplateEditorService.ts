import type { Template } from '../context/TemplateEditorTypes'

export type CreateTemplateData = {
  name: string
  subject: string
  previewText?: string
  mailyJson?: unknown
  html?: string
}

export type UpdateTemplateData = Partial<CreateTemplateData>

export interface ITemplateEditorService {
  getById(id: string): Promise<Template>
  create(data: CreateTemplateData): Promise<Template>
  update(id: string, data: UpdateTemplateData): Promise<Template>
}
