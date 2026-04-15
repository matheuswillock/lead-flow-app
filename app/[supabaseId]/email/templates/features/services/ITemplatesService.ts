import type { Template } from '../context/TemplatesTypes'

export type CreateTemplateData = {
  name: string
  subject: string
  previewText?: string
  mailyJson?: unknown
  html?: string
}

export interface ITemplatesService {
  list(): Promise<Template[]>
  create(data: CreateTemplateData): Promise<Template>
  delete(id: string): Promise<void>
}
