import { prisma } from "@/app/api/infra/data/prisma"
import { isAccountMasterBanned } from "@/lib/account/isAccountMasterBanned"
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
        },
      }),
      isAccountMasterBanned(billingOwnerId),
    ])

    if (!billingOwner) {
      return null
    }

    const subscription = billingOwner.subscription
    const canRecoverCard = await this.hasEligibleCardRecovery(billingOwnerId)
    return {
      billingOwnerId,
      subscriptionStatus: subscription ? subscription.subscriptionStatus : billingOwner.subscriptionStatus,
      subscriptionNextDueDate: subscription
        ? subscription.subscriptionNextDueDate
        : billingOwner.subscriptionNextDueDate,
      hasPermanentSubscription: subscription
        ? subscription.hasPermanentSubscription
        : billingOwner.hasPermanentSubscription,
      isBanned,
      canRecoverCard,
    }
  }

  private async hasEligibleCardRecovery(profileId: string): Promise<boolean> {
    const migration = await prisma.asaasAccountMigration.findFirst({
      where: {
        profileId,
        status: "paused_awaiting_card",
        primaryCustomerId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: { quoteSnapshot: true },
    })

    return migration?.quoteSnapshot !== null && migration?.quoteSnapshot !== undefined
  }

  private async resolveBillingOwnerId(input: {
    profile: { id: string; managerId: string | null; activeTeamId: string | null }
    teamId?: string | null
  }): Promise<string> {
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
      return input.profile.managerId ?? input.profile.id
    }

    const membership = await prisma.teamMember.findFirst({
      where: { teamId, profileId: input.profile.id },
      select: { id: true },
    })
    if (membership || team.master.sponsorMasterId === input.profile.id) {
      return team.masterId
    }

    return input.profile.managerId ?? input.profile.id
  }
}
