export type BackofficeHealthPlanItem = {
  id: string
  name: string
  normalizedName: string
  isActive: boolean
  isDefault: boolean
  iconUrl: string | null
  createdAt: string
  updatedAt: string
  activatedAt: string | null
  deactivatedAt: string | null
}

export type BackofficeHealthPlanPayload = {
  name: string
  iconUrl?: string | null
  isDefault?: boolean
}

export type BackofficeHealthPlanUpdatePayload = {
  name?: string
  iconUrl?: string | null
  isDefault?: boolean
  isActive?: boolean
}

export interface IBackofficeHealthPlansService {
  list(includeInactive?: boolean): Promise<BackofficeHealthPlanItem[]>
  create(payload: BackofficeHealthPlanPayload): Promise<{ isValid: boolean; errorMessages: string[] }>
  update(id: string, payload: BackofficeHealthPlanUpdatePayload): Promise<{ isValid: boolean; errorMessages: string[] }>
  deactivate(id: string, password: string): Promise<{ isValid: boolean; errorMessages: string[] }>
  activate(id: string, password: string): Promise<{ isValid: boolean; errorMessages: string[] }>
  uploadIcon(file: File): Promise<{ isValid: boolean; errorMessages: string[]; result?: { iconUrl: string } }>
}
