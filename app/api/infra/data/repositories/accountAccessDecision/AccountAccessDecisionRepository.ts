import { prisma } from "@/app/api/infra/data/prisma"
import { isAccountMasterBanned } from "@/lib/account/isAccountMasterBanned"
import {
  isActiveMemberProAssignment,
  isBlockingMemberProAssignment,
} from "@/app/api/shared/billing/memberProBillingRules"
import type {
  AccountAccessRecord,
  IAccountAccessDecisionRepository,
} from "@/app/api/shared/accountAccessDecision/types"

export class AccountAccessDecisionRepository implements IAccountAccessDecisionRepository {
  async resolveProfileId(supabaseId: string): Promise<string | null> {
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true },
    })

    return profile?.id ?? null
  }

  async resolveTeamMasterProfileId(teamId: string): Promise<string | null> {
    const team = await prisma.team.findFirst({ where: { id: teamId, deletedAt: null }, select: { masterId: true } })
    return team?.masterId ?? null
  }

  async resolveAccount(input: {
    profileId: string
    teamId?: string | null
  }): Promise<AccountAccessRecord | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: input.profileId },
      select: { id: true, managerId: true, activeTeamId: true },
    })

    if (!profile) {
      return null
    }

    const billingOwnerId = await this.resolveBillingOwnerId({
      profile,
      teamId: input.teamId,
    })
    if (!billingOwnerId) {
      return null
    }
    const effectiveTeamId = input.teamId ?? profile.activeTeamId
    const [billingOwner, isBanned] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: billingOwnerId },
        select: {
          hasPermanentSubscription: true,
          subscriptionNextDueDate: true,
          subscriptionStatus: true,
          subscription: {
            select: {
              hasPermanentSubscription: true,
              subscriptionNextDueDate: true,
              subscriptionStatus: true,
            },
          },
          userTypeAssignment: {
            select: {
              accessStartsAt: true,
              accessExpiresAt: true,
              userType: { select: { slug: true } },
            },
          },
        },
      }),
      isAccountMasterBanned(billingOwnerId),
    ])

    if (!billingOwner) {
      return null
    }

    const subscription = billingOwner.subscription
    const memberProAssignment = billingOwner.userTypeAssignment?.userType
      ? {
          slug: billingOwner.userTypeAssignment.userType.slug,
          accessStartsAt: billingOwner.userTypeAssignment.accessStartsAt,
          accessExpiresAt: billingOwner.userTypeAssignment.accessExpiresAt,
        }
      : null

    const temporaryAccessGrace = effectiveTeamId
      ? await this.resolveActiveBillingGrace(effectiveTeamId)
      : null

    return {
      billingOwnerId,
      subscriptionStatus: subscription ? subscription.subscriptionStatus : billingOwner.subscriptionStatus,
      subscriptionNextDueDate: subscription
        ? subscription.subscriptionNextDueDate
        : billingOwner.subscriptionNextDueDate,
      hasPermanentSubscription: subscription
        ? subscription.hasPermanentSubscription
        : billingOwner.hasPermanentSubscription,
      memberProActive: isActiveMemberProAssignment(memberProAssignment),
      memberProBlocked: isBlockingMemberProAssignment(memberProAssignment),
      temporaryAccessGranted: Boolean(temporaryAccessGrace),
      temporaryAccessUntil: temporaryAccessGrace?.expiresAt ?? null,
      isBanned,
    }
  }

  private async resolveActiveBillingGrace(teamId: string): Promise<{ expiresAt: Date | null } | null> {
    const indefiniteGrace = await prisma.billingAccessGrace.findFirst({
      where: { teamId, isActive: true, expiresAt: null },
      select: { expiresAt: true },
    })
    if (indefiniteGrace) return indefiniteGrace

    return prisma.billingAccessGrace.findFirst({
      where: { teamId, isActive: true, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "desc" },
      select: { expiresAt: true },
    })
  }

  private async resolveBillingOwnerId(input: {
    profile: { id: string; managerId: string | null; activeTeamId: string | null }
    teamId?: string | null
  }): Promise<string | null> {
    const teamId = input.teamId ?? input.profile.activeTeamId
    if (!teamId) {
      return input.profile.managerId ?? input.profile.id
    }

    const team = await prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: {
        masterId: true,
        master: { select: { sponsorMasterId: true } },
      },
    })
    if (!team) {
      return input.teamId ? null : input.profile.managerId ?? input.profile.id
    }

    const membership = await prisma.teamMember.findFirst({
      where: { teamId, profileId: input.profile.id },
      select: { id: true },
    })
    if (
      team.masterId === input.profile.id ||
      membership ||
      team.master.sponsorMasterId === input.profile.id
    ) {
      return team.masterId
    }

    return input.teamId ? null : input.profile.managerId ?? input.profile.id
  }
}
