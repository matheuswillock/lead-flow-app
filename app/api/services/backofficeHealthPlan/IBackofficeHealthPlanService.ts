export type BackofficeHealthPlanDTO = {
  id: string
  name: string
  normalizedName: string
  isActive: boolean
  isDefault: boolean
  iconUrl: string | null
  createdAt: Date
  updatedAt: Date
  activatedAt: Date | null
  deactivatedAt: Date | null
}

export type CreateBackofficeHealthPlanInput = {
  name: string
  iconUrl?: string | null
  isDefault?: boolean
  createdBy?: string | null
}

export type UpdateBackofficeHealthPlanInput = {
  name?: string
  iconUrl?: string | null
  isDefault?: boolean
  isActive?: boolean
}

export interface IBackofficeHealthPlanService {
  list(includeInactive: boolean): Promise<BackofficeHealthPlanDTO[]>
  create(input: CreateBackofficeHealthPlanInput): Promise<BackofficeHealthPlanDTO>
  update(id: string, input: UpdateBackofficeHealthPlanInput): Promise<BackofficeHealthPlanDTO | null>
  deactivate(id: string): Promise<BackofficeHealthPlanDTO | null>
}
