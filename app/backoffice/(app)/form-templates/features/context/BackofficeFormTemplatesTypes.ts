import type { BackofficeFormTemplateListItem } from "../services/IBackofficeFormTemplatesService"

export type BackofficeFormTemplatesState = {
  items: BackofficeFormTemplateListItem[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
}

export type BackofficeFormTemplatesContextValue = BackofficeFormTemplatesState & {
  canManage: boolean
  refresh: () => Promise<void>
  publishItem: (id: string) => Promise<{ isValid: boolean; errorMessages?: string[] }>
  unpublishItem: (id: string) => Promise<{ isValid: boolean; errorMessages?: string[] }>
}
