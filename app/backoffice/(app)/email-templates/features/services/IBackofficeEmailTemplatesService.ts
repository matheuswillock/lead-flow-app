export type TemplateListItem = {
  id: string
  name: string
  alias: string | null
  status: "draft" | "published"
  published_at: string | null
  created_at: string
  updated_at: string
}

export type TemplateDetail = {
  id: string
  name: string
  alias: string | null
  status: "draft" | "published"
  published_at: string | null
  created_at: string
  updated_at: string
  subject: string | null
  html: string
  text: string | null
  from: string | null
  reply_to: string[] | null
  variables: TemplateVariableItem[] | null
  has_unpublished_versions: boolean
  current_version_id: string
}

export type TemplateVariableItem = {
  key: string
  type: "string" | "number"
  fallback_value: string | number | null
  created_at: string
  updated_at: string
}

export type CreateTemplateFormData = {
  name: string
  html: string
  alias?: string
  from?: string
  subject?: string
  replyTo?: string
  text?: string
  variables: VariableFormItem[]
}

export type UpdateTemplateFormData = Partial<CreateTemplateFormData>

export type VariableFormItem = {
  key: string
  type: "string" | "number"
  fallbackValue?: string
}

export type OperationResult = {
  isValid: boolean
  errorMessages: string[]
  result?: unknown
}

export interface IBackofficeEmailTemplatesService {
  list(): Promise<TemplateListItem[]>
  get(id: string): Promise<TemplateDetail>
  create(data: CreateTemplateFormData): Promise<OperationResult>
  update(id: string, data: UpdateTemplateFormData): Promise<OperationResult>
  remove(id: string): Promise<OperationResult>
  publish(id: string): Promise<OperationResult>
  duplicate(id: string): Promise<OperationResult>
}
