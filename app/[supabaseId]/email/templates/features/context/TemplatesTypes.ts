export type TemplateStatus = "draft" | "published"
export type TemplateApprovalStatus = "pending_approval" | "approved" | "rejected"
export type TemplateTab = "all" | "draft" | "pending_approval" | "published" | "rejected"

export interface Template {
  id: string
  versionGroupId: string
  versionNumber: number
  isCurrentPublished: boolean
  name: string
  subject: string
  previewText: string | null
  mailyJson: unknown | null
  html: string | null
  status: TemplateStatus
  publishedAt: string | null
  approvalStatus: TemplateApprovalStatus
  reviewNote: string | null
  createdAt: string
  updatedAt: string
  creator: {
    id: string
    fullName: string | null
    email: string | null
  } | null
  managedByCorretorStudio?: boolean
}

export interface TemplatesState {
  templates: Template[]
  loading: boolean
  error: string | null
  deleting: string | null
  duplicating: string | null
  submitting: string | null
  approving: string | null
  rejecting: string | null
  activeTab: TemplateTab
  templateApprovalRequired: boolean
}
