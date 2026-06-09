import type {
  TemplateListItem,
  TemplateDetail,
  CreateTemplateFormData,
  UpdateTemplateFormData,
  OperationResult,
} from "../services/IBackofficeEmailTemplatesService"

export interface BackofficeEmailTemplatesContextValue {
  templates: TemplateListItem[]
  isLoading: boolean
  isCreating: boolean
  isUpdating: boolean
  isRemoving: boolean
  isPublishing: boolean
  isDuplicating: boolean
  canManage: boolean
  error: string | null
  fetchTemplates(): Promise<void>
  getTemplate(id: string): Promise<TemplateDetail | null>
  createTemplate(data: CreateTemplateFormData): Promise<OperationResult>
  updateTemplate(id: string, data: UpdateTemplateFormData): Promise<OperationResult>
  removeTemplate(id: string): Promise<OperationResult>
  publishTemplate(id: string): Promise<OperationResult>
  duplicateTemplate(id: string): Promise<OperationResult>
}
