import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeFeature,
  BackofficeFeatureGrant,
} from "@prisma/client"
import type {
  BackofficeFeatureWithRelations,
  CreateBackofficeFeatureInput,
  IBackofficeFeatureRepository,
  UpdateBackofficeFeatureInput,
  UpsertBackofficeFeatureBetaGrantInput,
} from "./IBackofficeFeatureRepository"

export class BackofficeFeatureRepository implements IBackofficeFeatureRepository {
  async findAll(): Promise<BackofficeFeatureWithRelations[]> {
    return prisma.backofficeFeature.findMany({
      include: {
        parent: { select: { id: true, slug: true, name: true } },
        children: { select: { id: true, slug: true, name: true }, orderBy: { sortOrder: "asc" } },
        grants: {
          where: { grantType: "BETA" },
          include: {
            profile: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
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
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.backofficeFeature.delete({ where: { id } })
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
  ): Promise<BackofficeFeatureGrant> {
    return prisma.backofficeFeatureGrant.upsert({
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
      },
      create: {
        featureId: data.featureId,
        profileId: data.profileId,
        grantType: "BETA",
        accessLevel: data.accessLevel ?? "FULL",
        isActive: true,
      },
    })
  }

  async disableBetaGrant(featureId: string, profileId: string): Promise<void> {
    await prisma.backofficeFeatureGrant.updateMany({
      where: { featureId, profileId, grantType: "BETA" },
      data: { isActive: false },
    })
  }

  async listBetaGrants(featureId: string): Promise<BackofficeFeatureWithRelations["grants"]> {
    return prisma.backofficeFeatureGrant.findMany({
      where: { featureId, grantType: "BETA" },
      include: {
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
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
}
