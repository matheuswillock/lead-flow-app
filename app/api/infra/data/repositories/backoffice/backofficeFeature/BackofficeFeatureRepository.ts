import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeAccessPrincipal,
  BackofficeFeature,
  BackofficeFeatureAccessLevel,
  BackofficeFeatureAccessRule,
  BackofficeFeatureGrant,
} from "@prisma/client"
import type {
  BackofficeBetaGrantWithRelations,
  BackofficeFeatureWithRelations,
  CreateBackofficeFeatureInput,
  IBackofficeFeatureRepository,
  MasterProfileRecord,
  PlatformUserSearchResult,
  UpdateBackofficeFeatureInput,
  UpsertBackofficeFeatureBetaGrantInput,
} from "./IBackofficeFeatureRepository"

const MASTER_BETA_GRANT_WHERE = {
  grantType: "BETA" as const,
  profile: { isMaster: true, role: "manager" as const },
}

const BETA_GRANT_INCLUDE = {
  profile: {
    select: {
      id: true,
      fullName: true,
      email: true,
      isMaster: true,
    },
  },
  teams: {
    include: {
      team: {
        select: { id: true, name: true },
      },
    },
  },
}

export class BackofficeFeatureRepository implements IBackofficeFeatureRepository {
  async findAll(): Promise<BackofficeFeatureWithRelations[]> {
    try {
      return await prisma.backofficeFeature.findMany({
        include: {
          parent: { select: { id: true, slug: true, name: true } },
          children: { select: { id: true, slug: true, name: true }, orderBy: { sortOrder: "asc" } },
          grants: {
            where: MASTER_BETA_GRANT_WHERE,
            include: BETA_GRANT_INCLUDE,
            orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
          },
          accessRules: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    } catch (error) {
      if (this.isMissingAccessRulesTable(error)) {
        const features = await prisma.backofficeFeature.findMany({
          include: {
            parent: { select: { id: true, slug: true, name: true } },
            children: { select: { id: true, slug: true, name: true }, orderBy: { sortOrder: "asc" } },
            grants: {
              where: MASTER_BETA_GRANT_WHERE,
              include: BETA_GRANT_INCLUDE,
              orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
            },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })

        return features.map((feature) => ({ ...feature, accessRules: [] }))
      }

      throw error
    }
  }

  async findActive(): Promise<BackofficeFeature[]> {
    return prisma.backofficeFeature.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
  }

  async findById(id: string): Promise<BackofficeFeature | null> {
    return prisma.backofficeFeature.findUnique({ where: { id } })
  }

  async findBySlug(slug: string): Promise<BackofficeFeature | null> {
    return prisma.backofficeFeature.findUnique({ where: { slug } })
  }

  async productSlugExists(slug: string): Promise<boolean> {
    const product = await prisma.backofficeProduct.findUnique({
      where: { slug },
      select: { id: true },
    })
    return !!product
  }

  async profileExists(profileId: string): Promise<boolean> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true },
    })
    return !!profile
  }

  async create(data: CreateBackofficeFeatureInput): Promise<BackofficeFeature> {
    return prisma.backofficeFeature.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        parentId: data.parentId ?? null,
        productSlug: data.productSlug ?? null,
        accessMode: data.accessMode,
        defaultAccessLevel: data.defaultAccessLevel,
        betaEnabled: data.betaEnabled ?? false,
        inheritParentSettings: data.inheritParentSettings ?? false,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    })
  }

  async update(id: string, data: UpdateBackofficeFeatureInput): Promise<BackofficeFeature> {
    return prisma.backofficeFeature.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(Object.prototype.hasOwnProperty.call(data, "description") && {
          description: data.description ?? null,
        }),
        ...(Object.prototype.hasOwnProperty.call(data, "parentId") && {
          parentId: data.parentId ?? null,
        }),
        ...(Object.prototype.hasOwnProperty.call(data, "productSlug") && {
          productSlug: data.productSlug ?? null,
        }),
        ...(data.accessMode !== undefined && { accessMode: data.accessMode }),
        ...(data.defaultAccessLevel !== undefined && {
          defaultAccessLevel: data.defaultAccessLevel,
        }),
        ...(data.betaEnabled !== undefined && { betaEnabled: data.betaEnabled }),
        ...(data.inheritParentSettings !== undefined && {
          inheritParentSettings: data.inheritParentSettings,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.backofficeFeature.delete({ where: { id } })
  }

  async findProfileById(profileId: string): Promise<MasterProfileRecord | null> {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true, isMaster: true, role: true },
    })
  }

  async validateTeamsBelongToMaster(masterId: string, teamIds: string[]): Promise<boolean> {
    if (teamIds.length === 0) return false

    const count = await prisma.team.count({
      where: {
        id: { in: teamIds },
        masterId,
      },
    })

    return count === teamIds.length
  }

  async searchUsers(
    query: string,
    page: number,
    pageSize: number,
    options?: { mastersOnly?: boolean }
  ): Promise<PlatformUserSearchResult> {
    const skip = (page - 1) * pageSize
    const searchFilter = query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" as const } },
            { email: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}

    const where = options?.mastersOnly
      ? { isMaster: true, role: "manager" as const, ...searchFilter }
      : searchFilter

    const [items, totalItems] = await Promise.all([
      prisma.profile.findMany({
        where,
        select: { id: true, fullName: true, email: true, profileIconUrl: true },
        orderBy: { fullName: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.profile.count({ where }),
    ])

    return { items, totalItems }
  }

  async listAvailableSlugs(): Promise<string[]> {
    const rows = await prisma.backofficeFeature.findMany({
      where: { isActive: true },
      select: { slug: true },
      orderBy: { slug: "asc" },
    })
    return rows.map((item) => item.slug)
  }

  async upsertBetaGrant(
    data: UpsertBackofficeFeatureBetaGrantInput
  ): Promise<BackofficeBetaGrantWithRelations> {
    return prisma.$transaction(async (tx) => {
      const grant = await tx.backofficeFeatureGrant.upsert({
        where: {
          featureId_profileId_grantType: {
            featureId: data.featureId,
            profileId: data.profileId,
            grantType: "BETA",
          },
        },
        update: {
          isActive: true,
          accessLevel: data.accessLevel ?? "FULL",
          betaTeamScope: data.betaTeamScope,
        },
        create: {
          featureId: data.featureId,
          profileId: data.profileId,
          grantType: "BETA",
          accessLevel: data.accessLevel ?? "FULL",
          betaTeamScope: data.betaTeamScope,
          isActive: true,
        },
      })

      await tx.backofficeFeatureGrantTeam.deleteMany({
        where: { grantId: grant.id },
      })

      if (data.betaTeamScope === "SPECIFIC_TEAMS" && data.teamIds && data.teamIds.length > 0) {
        await tx.backofficeFeatureGrantTeam.createMany({
          data: data.teamIds.map((teamId) => ({
            grantId: grant.id,
            teamId,
          })),
        })
      }

      return tx.backofficeFeatureGrant.findUniqueOrThrow({
        where: { id: grant.id },
        include: BETA_GRANT_INCLUDE,
      })
    })
  }

  async upsertAccessRule(
    featureId: string,
    principal: BackofficeAccessPrincipal,
    accessLevel: BackofficeFeatureAccessLevel
  ): Promise<BackofficeFeatureAccessRule> {
    return prisma.backofficeFeatureAccessRule.upsert({
      where: {
        featureId_principal: {
          featureId,
          principal,
        },
      },
      update: {
        accessLevel,
      },
      create: {
        featureId,
        principal,
        accessLevel,
      },
    })
  }

  async deleteAccessRule(featureId: string, principal: BackofficeAccessPrincipal): Promise<void> {
    await prisma.backofficeFeatureAccessRule.deleteMany({
      where: {
        featureId,
        principal,
      },
    })
  }

  async replaceAccessRules(
    featureId: string,
    rules: Array<{ principal: BackofficeAccessPrincipal; accessLevel: BackofficeFeatureAccessLevel }>
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.backofficeFeatureAccessRule.deleteMany({
        where: { featureId },
      })

      if (rules.length > 0) {
        await tx.backofficeFeatureAccessRule.createMany({
          data: rules.map((rule) => ({
            featureId,
            principal: rule.principal,
            accessLevel: rule.accessLevel,
          })),
        })
      }
    })
  }

  async disableBetaGrant(featureId: string, profileId: string): Promise<void> {
    await prisma.backofficeFeatureGrant.updateMany({
      where: { featureId, profileId, grantType: "BETA" },
      data: { isActive: false },
    })
  }

  async listBetaGrants(featureId: string): Promise<BackofficeBetaGrantWithRelations[]> {
    return prisma.backofficeFeatureGrant.findMany({
      where: { featureId, ...MASTER_BETA_GRANT_WHERE },
      include: BETA_GRANT_INCLUDE,
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    })
  }

  async listActiveBetaGrantsForProfile(
    profileId: string
  ): Promise<Array<Pick<BackofficeFeatureGrant, "featureId">>> {
    return prisma.backofficeFeatureGrant.findMany({
      where: {
        profileId,
        grantType: "BETA",
        isActive: true,
      },
      select: { featureId: true },
    })
  }

  private isMissingAccessRulesTable(error: unknown): boolean {
    const parsed = error as { code?: string; meta?: { table?: string } }
    return (
      parsed?.code === "P2021" &&
      parsed?.meta?.table === "public.backoffice_feature_access_rules"
    )
  }
}
