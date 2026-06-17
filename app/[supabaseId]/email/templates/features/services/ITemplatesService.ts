import type { Template } from '../context/TemplatesTypes'

export type CreateTemplateData = {
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
  submitForApproval(supabaseId: string, id: string, teamId?: string | null): Promise<Template>
  approve(supabaseId: string, id: string, teamId?: string | null): Promise<Template>
  reject(supabaseId: string, id: string, reviewNote: string, teamId?: string | null): Promise<Template>
}
