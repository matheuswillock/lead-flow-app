export type BackofficeHealthPlanEntity = {
  id: string
  name: string
  normalizedName: string
  isActive: boolean
  isDefault: boolean
  iconUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface IBackofficeHealthPlanRepository {
  list(includeInactive: boolean): Promise<BackofficeHealthPlanEntity[]>
  create(input: {
    name: string
    normalizedName: string
    iconUrl: string | null
    isDefault: boolean
    createdBy: string | null
  }): Promise<BackofficeHealthPlanEntity>
  clearDefault(exceptId?: string): Promise<void>
  findById(id: string): Promise<{ id: string } | null>
  update(
    id: string,
    input: {
      name?: string
      normalizedName?: string
      iconUrl?: string | null
      isDefault?: boolean
      isActive?: boolean
    }
  ): Promise<BackofficeHealthPlanEntity>
}
