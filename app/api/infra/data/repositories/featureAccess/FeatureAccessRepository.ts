import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeFeature,
  BackofficeFeatureAccessRule,
  BackofficeFeatureGrant,
  BackofficeUserSubscription,
  Profile,
  ProfileSubscription,
} from "@prisma/client"
import type { IFeatureAccessRepository, OwnerUserTypeAssignment, UserRoleInfo, BetaEligibilityContext, EmailBetaAccessContext } from "./IFeatureAccessRepository"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"

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
      product: { featureSlug: string } | null
    }) | null
  > {
    return prisma.profileSubscription.findUnique({
      where: { profileId: ownerProfileId },
      select: {
        hasPermanentSubscription: true,
        subscriptionStatus: true,
        product: { select: { featureSlug: true } },
      },
    })
  }

  async listActiveUserSubscriptions(
    profileId: string
  ): Promise<Array<BackofficeUserSubscription & { product: { featureSlug: string } }>> {
    const now = new Date()
    return prisma.backofficeUserSubscription.findMany({
      where: {
        profileId,
        status: "active",
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        product: {
          select: { featureSlug: true },
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

      // O master é o dono do grant — é elegível independente do escopo de time,
      // que controla apenas a distribuição para membros do time.
      if (ctx.isMaster) {
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

  async resolveEmailBetaAccess(ctx: EmailBetaAccessContext): Promise<boolean> {
    const grantOwnerId = ctx.isMaster ? ctx.profileId : ctx.managerId
    if (!grantOwnerId) return false

    type FeatureNode = {
      id: string
      parentId: string | null
      inheritParentSettings: boolean
      betaEnabled: boolean
      isActive: boolean
    }

    const visited = new Set<string>()
    let current: FeatureNode | null = await prisma.backofficeFeature.findFirst({
      where: { slug: FEATURE_SLUGS.EMAIL_CAMPAIGNS, isActive: true },
      select: {
        id: true,
        parentId: true,
        inheritParentSettings: true,
        betaEnabled: true,
        isActive: true,
      },
    })

    if (!current) {
      current = await prisma.backofficeFeature.findFirst({
        where: { slug: FEATURE_SLUGS.EMAIL, isActive: true },
        select: {
          id: true,
          parentId: true,
          inheritParentSettings: true,
          betaEnabled: true,
          isActive: true,
        },
      })
    }

    if (!current) return false

    while (current.inheritParentSettings && current.parentId && !visited.has(current.id)) {
      visited.add(current.id)
      const parent: FeatureNode | null = await prisma.backofficeFeature.findUnique({
        where: { id: current.parentId },
        select: {
          id: true,
          parentId: true,
          inheritParentSettings: true,
          betaEnabled: true,
          isActive: true,
        },
      })
      if (!parent || !parent.isActive) break
      current = parent
    }

    if (!current.betaEnabled) return false

    const emailRoot = await prisma.backofficeFeature.findFirst({
      where: { slug: FEATURE_SLUGS.EMAIL, isActive: true },
      select: { id: true },
    })

    const candidateFeatureIds = Array.from(
      new Set([current.id, emailRoot?.id].filter((id): id is string => Boolean(id)))
    )

    const grants = await prisma.backofficeFeatureGrant.findMany({
      where: {
        profileId: grantOwnerId,
        grantType: "BETA",
        isActive: true,
        featureId: { in: candidateFeatureIds },
      },
      select: {
        betaTeamScope: true,
        teams: {
          select: { teamId: true },
        },
      },
    })

    if (grants.length === 0) return false

    for (const grant of grants) {
      if (grant.betaTeamScope === "ALL_TEAMS") {
        return true
      }

      if (ctx.isMaster) {
        return true
      }

      const scopedTeamIds = grant.teams.map((item) => item.teamId)
      if (scopedTeamIds.includes(ctx.teamId)) {
        return true
      }
    }

    return false
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

export const featureAccessRepository = new FeatureAccessRepository()
