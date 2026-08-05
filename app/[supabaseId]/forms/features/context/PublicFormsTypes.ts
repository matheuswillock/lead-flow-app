import type { PublicFormDraftInput } from "@/lib/public-forms/types"

export type PublicFormListItem = {
  id: string
  name: string
  publicId: string
  status: "draft" | "published" | "archived"
  approvalStatus: "draft" | "pending_approval" | "approved" | "rejected"
  assignedSdr: { id: string; fullName: string | null } | null
  updatedAt: string
  _count: { submissions: number }
  publications: Array<{ id: string; version: number }>
  managedByCorretorStudio?: boolean
  emailCampaignTrackingEnabled?: boolean
}

export type PublicFormsPage = {
  items: PublicFormListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  capabilities: { canEdit: boolean; canApprove: boolean }
}

export type PublicFormSettings = {
  approvalRequired: boolean
  approverRoles: Array<"manager" | "backoffice" | "operator">
  defaultBackgroundColor: string
  defaultTextColor: string
  defaultLineColor: string
  defaultAccentColor: string
  defaultButtonTextColor: string
  defaultInputBackgroundColor: string
}

export type PublicFormDetail = PublicFormDraftInput &
  PublicFormListItem & {
    capabilities: { canEdit: boolean; canApprove: boolean }
    eligibleClosers: Array<{
      profileId: string
      profile: { id: string; fullName: string | null; email: string | null }
    }>
  }

export type PublicFormsIds = { supabaseId: string; teamId: string }

export type RankedForm = {
  formId: string
  name: string
  viewed: number
  completed: number
  conversionRate: number
  rank: number
}
