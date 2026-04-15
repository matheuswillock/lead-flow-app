export interface Template {
  id: string
  name: string
  subject: string
  previewText: string | null
  mailyJson: unknown | null
  html: string | null
  createdAt: string
  updatedAt: string
  creator?: { id: string; fullName: string }
}

export interface TemplatesState {
  templates: Template[]
  loading: boolean
  error: string | null
  deleting: string | null
}
