export interface TemplatePickerItem {
  id: string
  name: string
  subject: string
  thumbnailUrl?: string
  updatedAt: string
}

export interface TemplateContent {
  id: string
  mailyJson: unknown | null
  html: string | null
  subject: string
  previewText: string | null
}

export interface ITemplatePickerService {
  listTemplates(teamId: string): Promise<TemplatePickerItem[]>
  getTemplateContent(id: string): Promise<TemplateContent>
}
