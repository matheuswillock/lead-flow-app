import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeFeature,
  BackofficeFeatureAccessRule,
  BackofficeFeatureGrant,
  BackofficeUserSubscription,
  Profile,
  ProfileSubscription,
} from "@prisma/client"
import type { IFeatureAccessRepository, OwnerUserTypeAssignment, UserRoleInfo, BetaEligibilityContext } from "./IFeatureAccessRepository"

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

  async resolveBetaEligibleFeatureIds(ctx: BetaEligibilityContext): Promise<Set<string>> {
    const eligible = new Set<string>()
    const grantOwnerId = ctx.isMaster ? ctx.profileId : ctx.managerId

    if (!grantOwnerId) {
      return eligible
    }

    const grants = await prisma.backofficeFeatureGrant.findMany({
      where: {
        profileId: grantOwnerId,
        grantType: "BETA",
        isActive: true,
      },
      select: {
        featureId: true,
        betaTeamScope: true,
        teams: {
          select: { teamId: true },
        },
      },
    })

    for (const grant of grants) {
      if (grant.betaTeamScope === "ALL_TEAMS") {
        eligible.add(grant.featureId)
        continue
      }

      if (!ctx.activeTeamId) {
        continue
      }

      const scopedTeamIds = grant.teams.map((item) => item.teamId)
      if (scopedTeamIds.includes(ctx.activeTeamId)) {
        eligible.add(grant.featureId)
      }
    }

    return eligible
  }

  async findCurrentUserRoleInfo(profileId: string): Promise<UserRoleInfo | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        isMaster: true,
        activeTeamId: true,
      },
    })
    if (!profile) return null

    const membership = profile.activeTeamId
      ? await prisma.teamMember.findUnique({
          where: {
            teamId_profileId: {
              teamId: profile.activeTeamId,
              profileId,
            },
          },
          select: {
            role: true,
            functions: true,
            canManageAccountTeams: true,
            canCreateAccountUsers: true,
            team: {
              select: {
                masterId: true,
              },
            },
          },
        })
      : null

    const isTeamMaster =
      membership !== null && membership.team.masterId === profileId

    return {
      isMaster: isTeamMaster,
      role: membership?.role ?? "operator",
      functions: (membership?.functions ?? []) as string[],
      canManageAccountTeams:
        membership?.role === "manager" && membership.canManageAccountTeams === true,
      canCreateAccountUsers:
        membership?.role === "manager" && membership.canCreateAccountUsers === true,
      userTypeSlug: "common",
      memberProActive: false,
      memberProExpiresAt: null,
      activeTeamId: profile.activeTeamId,
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
    if (!assignment || !assignment.userType) return null

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
