import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import type { PublicFormSettings } from "@/app/[supabaseId]/forms/features/context/PublicFormsTypes"
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types"

export type BackofficeFormTemplateListItem = {
  id: string
  slug: string
  name: string
  description: string | null
  formKind: string
  sortOrder: number
  isActive: boolean
  updatedAt: string
}

export type BackofficeFormTemplateDetail = BackofficeFormTemplateListItem & {
  draft: PublicFormDraftInput
}

export type BackofficeFormTemplateWizardContext = {
  members: Array<{ profileId: string; name: string; functions: string[] }>
  customFields: LeadCustomFieldDefinitionDTO[]
  healthPlans: Array<{ id: string; name: string }>
  settings: PublicFormSettings | null
}

export interface IBackofficeFormTemplatesService {
  list(includeInactive?: boolean): Promise<BackofficeFormTemplateListItem[]>
  get(templateId: string): Promise<BackofficeFormTemplateDetail>
  create(input: {
    slug: string
    name: string
    description?: string | null
    formKind?: string
    sortOrder?: number
    draft: PublicFormDraftInput
  }): Promise<BackofficeFormTemplateDetail>
  update(
    templateId: string,
    input: {
      name?: string
      description?: string | null
      formKind?: string
      sortOrder?: number
      draft?: PublicFormDraftInput
    },
  ): Promise<BackofficeFormTemplateDetail>
  publish(templateId: string): Promise<BackofficeFormTemplateDetail>
  unpublish(templateId: string): Promise<BackofficeFormTemplateDetail>
  getWizardContext(): Promise<BackofficeFormTemplateWizardContext>
}
