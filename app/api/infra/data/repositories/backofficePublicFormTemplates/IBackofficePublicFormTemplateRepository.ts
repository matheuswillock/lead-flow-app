import type { PublicFormDraftInput } from "@/lib/public-forms/types"

export type BackofficePublicFormTemplateListItem = {
  id: string
  slug: string
  name: string
  description: string | null
  formKind: string
  sortOrder: number
  isActive: boolean
  updatedAt: string
}

export type BackofficePublicFormTemplateDetail = BackofficePublicFormTemplateListItem & {
  draft: PublicFormDraftInput
}

export type CreateBackofficePublicFormTemplateInput = {
  slug: string
  name: string
  description?: string | null
  formKind?: string
  sortOrder?: number
  draft: PublicFormDraftInput
}

export type UpdateBackofficePublicFormTemplateInput = {
  name?: string
  description?: string | null
  formKind?: string
  sortOrder?: number
  draft?: PublicFormDraftInput
  isActive?: boolean
}

export interface IBackofficePublicFormTemplateRepository {
  list(includeInactive: boolean): Promise<BackofficePublicFormTemplateListItem[]>
  findById(id: string): Promise<BackofficePublicFormTemplateDetail | null>
  findBySlug(slug: string): Promise<BackofficePublicFormTemplateDetail | null>
  create(input: CreateBackofficePublicFormTemplateInput): Promise<BackofficePublicFormTemplateDetail>
  update(
    id: string,
    input: UpdateBackofficePublicFormTemplateInput,
  ): Promise<BackofficePublicFormTemplateDetail | null>
}
