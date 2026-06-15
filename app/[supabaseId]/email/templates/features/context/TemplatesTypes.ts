export type TemplateStatus = "draft" | "published"

export interface Template {
  id: string
  name: string
  subject: string
  previewText: string | null
  mailyJson: unknown | null
  html: string | null
  status: TemplateStatus
  publishedAt: string | null
  approvalStatus: string
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    fullName: string | null
    email: string | null
  } | null
}

export interface TemplatesState {
  templates: Template[]
  loading: boolean
  error: string | null
  deleting: string | null
  duplicating: string | null
}
