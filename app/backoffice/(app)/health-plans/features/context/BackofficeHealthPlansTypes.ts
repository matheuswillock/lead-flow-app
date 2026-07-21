import type {
  BackofficeHealthPlanItem,
  BackofficeHealthPlanPayload,
  BackofficeHealthPlanUpdatePayload,
} from "../services/IBackofficeHealthPlansService"

export type BackofficeHealthPlansState = {
  items: BackofficeHealthPlanItem[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
}

export type BackofficeHealthPlansActions = {
  refresh: () => Promise<void>
  createItem: (payload: BackofficeHealthPlanPayload) => Promise<{ isValid: boolean; errorMessages: string[] }>
  updateItem: (id: string, payload: BackofficeHealthPlanUpdatePayload) => Promise<{ isValid: boolean; errorMessages: string[] }>
  deactivateItem: (id: string, password: string) => Promise<{ isValid: boolean; errorMessages: string[] }>
  activateItem: (id: string, password: string) => Promise<{ isValid: boolean; errorMessages: string[] }>
  uploadIcon: (file: File) => Promise<{ isValid: boolean; errorMessages: string[]; result?: { iconUrl: string } }>
}

export type BackofficeHealthPlansContextValue = BackofficeHealthPlansState & BackofficeHealthPlansActions & {
  canManage: boolean
}
