import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeHealthPlanEntity,
  IBackofficeHealthPlanRepository,
} from "./IBackofficeHealthPlanRepository"

const select = {
  id: true,
  name: true,
  normalizedName: true,
  isActive: true,
  isDefault: true,
  iconUrl: true,
  createdAt: true,
  updatedAt: true,
  activatedAt: true,
  deactivatedAt: true,
} as const

export class BackofficeHealthPlanRepository implements IBackofficeHealthPlanRepository {
  async list(includeInactive: boolean): Promise<BackofficeHealthPlanEntity[]> {
    return prisma.healthPlanOption.findMany({
      where: includeInactive ? undefined : { isActive: true },
      select,
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    })
  }

  async create(input: {
    name: string
    normalizedName: string
    iconUrl: string | null
    isDefault: boolean
    createdBy: string | null
  }): Promise<BackofficeHealthPlanEntity> {
    return prisma.healthPlanOption.create({
      data: {
        name: input.name,
        normalizedName: input.normalizedName,
        iconUrl: input.iconUrl,
        isDefault: input.isDefault,
        createdBy: input.createdBy,
      },
      select,
    })
  }

  async clearDefault(exceptId?: string): Promise<void> {
    await prisma.healthPlanOption.updateMany({
      where: { isDefault: true, isActive: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isDefault: false },
    })
  }

  async findById(id: string): Promise<{ id: string } | null> {
    return prisma.healthPlanOption.findUnique({ where: { id }, select: { id: true } })
  }

  async update(
    id: string,
    input: {
      name?: string
      normalizedName?: string
      iconUrl?: string | null
      isDefault?: boolean
      isActive?: boolean
    }
  ): Promise<BackofficeHealthPlanEntity> {
    return prisma.healthPlanOption.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.normalizedName !== undefined ? { normalizedName: input.normalizedName } : {}),
        ...(input.iconUrl !== undefined ? { iconUrl: input.iconUrl } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.isActive !== undefined
          ? {
              isActive: input.isActive,
              ...(input.isActive ? { activatedAt: new Date() } : { deactivatedAt: new Date() }),
            }
          : {}),
      },
      select,
    })
  }
}
