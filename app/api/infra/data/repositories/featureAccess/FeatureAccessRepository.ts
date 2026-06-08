import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeFeature,
  BackofficeFeatureAccessRule,
  BackofficeFeatureGrant,
  BackofficeUserSubscription,
  Profile,
  ProfileSubscription,
} from "@prisma/client"
import type { IFeatureAccessRepository, OwnerUserTypeAssignment, UserRoleInfo } from "./IFeatureAccessRepository"

export class FeatureAccessRepository implements IFeatureAccessRepository {
  async listActiveFeatures(): Promise<Array<BackofficeFeature & { accessRules: BackofficeFeatureAccessRule[] }>> {
    try {
      return await prisma.backofficeFeature.findMany({
        where: { isActive: true },
        include: {
          accessRules: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    } catch (error) {
      if (this.isMissingAccessRulesTable(error)) {
        const features = await prisma.backofficeFeature.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
        return features.map((feature) => ({ ...feature, accessRules: [] }))
      }
      throw error
    }
  }

  async findOwnerProfile(ownerProfileId: string): Promise<Pick<Profile, "hasPermanentSubscription" | "subscriptionStatus"> | null> {
    return prisma.profile.findUnique({
      where: { id: ownerProfileId },
      select: {
        hasPermanentSubscription: true,
        subscriptionStatus: true,
      },
    })
  }

  async findOwnerProfileSubscription(
    ownerProfileId: string
  ): Promise<
    (Pick<ProfileSubscription, "hasPermanentSubscription" | "subscriptionStatus"> & {
      product: { slug: string } | null
    }) | null
  > {
    return prisma.profileSubscription.findUnique({
      where: { profileId: ownerProfileId },
      select: {
        hasPermanentSubscription: true,
        subscriptionStatus: true,
        product: { select: { slug: true } },
      },
    })
  }

  async listActiveUserSubscriptions(
    profileId: string
  ): Promise<Array<BackofficeUserSubscription & { product: { slug: string } }>> {
    const now = new Date()
    return prisma.backofficeUserSubscription.findMany({
      where: {
        profileId,
        status: "active",
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        product: {
          select: { slug: true },
        },
      },
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

  async findCurrentUserRoleInfo(profileId: string): Promise<UserRoleInfo | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        isMaster: true,
        role: true,
        functions: true,
        canManageAccountTeams: true,
        canCreateAccountUsers: true,
      },
    })
    if (!profile) return null

    return {
      isMaster: profile.isMaster,
      role: profile.role,
      functions: profile.functions as string[],
      canManageAccountTeams: profile.canManageAccountTeams,
      canCreateAccountUsers: profile.canCreateAccountUsers,
      userTypeSlug: "common",
      memberProActive: false,
      memberProExpiresAt: null,
    }
  }

  async findUserTypeAssignment(ownerProfileId: string): Promise<OwnerUserTypeAssignment | null> {
    const assignment = await prisma.profileUserTypeAssignment.findUnique({
      where: { profileId: ownerProfileId },
      select: {
        accessExpiresAt: true,
        userType: { select: { slug: true } },
      },
    })
    if (!assignment) return null

    return {
      slug: assignment.userType.slug,
      accessExpiresAt: assignment.accessExpiresAt ? assignment.accessExpiresAt.toISOString() : null,
    }
  }

  private isMissingAccessRulesTable(error: unknown): boolean {
    const parsed = error as { code?: string; meta?: { table?: string } }
    return (
      parsed?.code === "P2021" &&
      parsed?.meta?.table === "public.backoffice_feature_access_rules"
    )
  }
}
