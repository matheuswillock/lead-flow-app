import {
  type BackofficeHealthPlanDTO,
  type CreateBackofficeHealthPlanInput,
  type IBackofficeHealthPlanService,
  type UpdateBackofficeHealthPlanInput,
} from "./IBackofficeHealthPlanService"
import { normalizeHealthPlanName } from "@/lib/healthPlans"
import type { IBackofficeHealthPlanRepository } from "@/app/api/infra/data/repositories/backoffice/healthPlan/IBackofficeHealthPlanRepository"
import { BackofficeHealthPlanRepository } from "@/app/api/infra/data/repositories/backoffice/healthPlan/BackofficeHealthPlanRepository"

export class BackofficeHealthPlanService implements IBackofficeHealthPlanService {
  constructor(private readonly repository: IBackofficeHealthPlanRepository) {}

  async list(includeInactive: boolean): Promise<BackofficeHealthPlanDTO[]> {
    return this.repository.list(includeInactive)
  }

  async create(input: CreateBackofficeHealthPlanInput): Promise<BackofficeHealthPlanDTO> {
    const normalizedName = normalizeHealthPlanName(input.name)
    if (input.isDefault) {
      await this.repository.clearDefault()
    }
    return this.repository.create({
      name: input.name,
      normalizedName,
      iconUrl: input.iconUrl ?? null,
      isDefault: input.isDefault ?? false,
      createdBy: input.createdBy ?? null,
    })
  }

  async update(id: string, input: UpdateBackofficeHealthPlanInput): Promise<BackofficeHealthPlanDTO | null> {
    const existing = await this.repository.findById(id)
    if (!existing) return null

    if (input.isDefault) {
      await this.repository.clearDefault(id)
    }

    return this.repository.update(id, {
      ...(input.name !== undefined
        ? {
            name: input.name,
            normalizedName: normalizeHealthPlanName(input.name),
          }
        : {}),
      ...(input.iconUrl !== undefined ? { iconUrl: input.iconUrl } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
  }

  async deactivate(id: string): Promise<BackofficeHealthPlanDTO | null> {
    const existing = await this.repository.findById(id)
    if (!existing) return null
    return this.repository.update(id, { isActive: false, isDefault: false })
  }
}

export const backofficeHealthPlanService = new BackofficeHealthPlanService(
  new BackofficeHealthPlanRepository()
)
