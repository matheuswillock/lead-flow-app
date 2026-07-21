import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type { BillingSnapshot } from "@/app/api/infra/data/repositories/billing/IBillingRepository";
import { buildBillingSummary } from "@/app/api/shared/billing/billingSummary";
import type { BillingSummary } from "@/app/api/shared/billing/billingConfig";
import { resolveHasUnlimitedUsers } from "@/app/api/shared/billing/memberProBillingRules";

type TransactionClient = Prisma.TransactionClient;

export interface SubscriptionCreditMutationInput {
  teams?: number;
  users?: number;
}

export interface SubscriptionCreditRemovalResult {
  summary: BillingSummary;
  targetRecurringTotal: number;
}

class PrismaSubscriptionCreditRepository {
  async getSummary(masterId: string): Promise<BillingSummary> {
    return prisma.$transaction((tx) => this.getSummaryWithTx(tx, masterId));
  }

  async assertCapacityAvailable(
    tx: TransactionClient,
    masterId: string,
    input: SubscriptionCreditMutationInput
  ): Promise<BillingSummary> {
    await this.lockMasterSubscription(tx, masterId);
    const summary = await this.getSummaryWithTx(tx, masterId);
    const teams = Math.max(0, input.teams ?? 0);
    const users = Math.max(0, input.users ?? 0);

    const usersExceeded = !summary.hasUnlimitedUsers && users > summary.availableUserSlots;
    if (teams > summary.availableTeamSlots || usersExceeded) {
      throw new Error("Capacidade insuficiente para criar sem checkout");
    }

    return summary;
  }

  async applyCreditAddition(
    tx: TransactionClient,
    masterId: string,
    input: SubscriptionCreditMutationInput
  ): Promise<BillingSummary> {
    await this.lockMasterSubscription(tx, masterId);
    const subscriptionId = await this.ensureProfileSubscription(tx, masterId);
    const teams = Math.max(0, input.teams ?? 0);
    const users = Math.max(0, input.users ?? 0);

    await tx.profileSubscriptionCapacity.upsert({
      where: { profileSubscriptionId: subscriptionId },
      create: {
        profileSubscriptionId: subscriptionId,
        manualAdjustmentExtraTeams: teams,
        manualAdjustmentExtraUsers: users,
      },
      update: {
        manualAdjustmentExtraTeams: { increment: teams },
        manualAdjustmentExtraUsers: { increment: users },
      },
    });

    return this.getSummaryWithTx(tx, masterId);
  }

  async removeCredits(
    masterId: string,
    input: SubscriptionCreditMutationInput
  ): Promise<SubscriptionCreditRemovalResult> {
    return prisma.$transaction(async (tx) => {
      await this.lockMasterSubscription(tx, masterId);
      const subscriptionId = await this.ensureProfileSubscription(tx, masterId);
      const currentSummary = await this.getSummaryWithTx(tx, masterId);
      const teams = Math.max(0, input.teams ?? 0);
      const users = Math.max(0, input.users ?? 0);

      if (teams > currentSummary.removableTeamSlots) {
        throw new Error(`Só é possível remover até ${currentSummary.removableTeamSlots} créditos de times.`);
      }

      if (users > currentSummary.removableUserSlots) {
        throw new Error(`Só é possível remover até ${currentSummary.removableUserSlots} créditos de usuários.`);
      }

      await tx.profileSubscriptionCapacity.upsert({
        where: { profileSubscriptionId: subscriptionId },
        create: {
          profileSubscriptionId: subscriptionId,
          manualAdjustmentExtraTeams: -teams,
          manualAdjustmentExtraUsers: -users,
        },
        update: {
          manualAdjustmentExtraTeams: { decrement: teams },
          manualAdjustmentExtraUsers: { decrement: users },
        },
      });

      const summary = await this.getSummaryWithTx(tx, masterId);

      return {
        summary,
        targetRecurringTotal: summary.totalPrice,
      };
    });
  }

  private async getSummaryWithTx(tx: TransactionClient, masterId: string): Promise<BillingSummary> {
    const snapshot = await this.getSnapshotWithTx(tx, masterId);
    if (!snapshot) {
      throw new Error("Master não encontrado");
    }

    return buildBillingSummary(masterId, snapshot);
  }

  private async getSnapshotWithTx(tx: TransactionClient, masterId: string): Promise<BillingSnapshot | null> {
    const master = await tx.profile.findUnique({
      where: { id: masterId },
      select: { hasPermanentSubscription: true, hasUnlimitedUsers: true },
    });

    if (!master) return null;

    const [teamCount, teamMembers, subscription] = await Promise.all([
      tx.team.count({ where: { masterId } }),
      tx.teamMember.findMany({
        where: { team: { masterId } },
        select: { profileId: true },
        distinct: ["profileId"],
      }),
      tx.profileSubscription.findUnique({
        where: { profileId: masterId },
        select: {
          capacity: {
            select: {
              includedExtraTeams: true,
              includedExtraUsers: true,
              manualAdjustmentExtraTeams: true,
              manualAdjustmentExtraUsers: true,
            },
          },
        },
      }),
    ]);

    const distinctUserCount = teamMembers.filter((member) => member.profileId !== masterId).length;
    const hasUnlimitedUsers = resolveHasUnlimitedUsers({
      hasUnlimitedUsersFlag: master.hasUnlimitedUsers,
      hasPermanentSubscription: master.hasPermanentSubscription,
    });

    return {
      hasPermanentSubscription: master.hasPermanentSubscription,
      hasUnlimitedUsers,
      teamCount,
      distinctUserCount,
      totalUsersIncludingMaster: distinctUserCount + 1,
      includedExtraTeams: subscription?.capacity?.includedExtraTeams ?? 0,
      includedExtraUsers: subscription?.capacity?.includedExtraUsers ?? 0,
      manualAdjustmentExtraTeams: subscription?.capacity?.manualAdjustmentExtraTeams ?? 0,
      manualAdjustmentExtraUsers: subscription?.capacity?.manualAdjustmentExtraUsers ?? 0,
    };
  }

  private async lockMasterSubscription(tx: TransactionClient, masterId: string): Promise<void> {
    await tx.$executeRaw`SELECT id FROM corretor_studio_profiles WHERE id = ${masterId}::uuid FOR UPDATE`;
  }

  private async ensureProfileSubscription(tx: TransactionClient, masterId: string): Promise<string> {
    const subscription = await tx.profileSubscription.upsert({
      where: { profileId: masterId },
      create: { profileId: masterId },
      update: {},
      select: { id: true },
    });

    return subscription.id;
  }
}

export const subscriptionCreditRepository = new PrismaSubscriptionCreditRepository();
