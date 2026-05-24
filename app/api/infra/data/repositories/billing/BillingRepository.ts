import prisma from "@/app/api/infra/data/prisma";
import type {
  BillingSnapshot,
  IBillingRepository,
  IUpdateBillingProfileSubscriptionData,
} from "./IBillingRepository";

type BillingQuota = Pick<
  BillingSnapshot,
  "includedExtraTeams" | "includedExtraUsers" | "manualAdjustmentExtraTeams" | "manualAdjustmentExtraUsers"
>;

class PrismaBillingRepository implements IBillingRepository {
  async getBillingSnapshot(masterId: string): Promise<BillingSnapshot | null> {
    const master = await prisma.profile.findUnique({
      where: { id: masterId },
      select: { hasPermanentSubscription: true },
    });

    if (!master) {
      return null;
    }

    const teamCount = await prisma.team.count({
      where: { masterId },
    });

    const teamMembers = await prisma.teamMember.findMany({
      where: {
        team: { masterId },
      },
      select: { profileId: true },
      distinct: ["profileId"],
    });

    const distinctUserCount = teamMembers.filter((member) => member.profileId !== masterId).length;
    const legacyQuota = await this.getLegacyAdhesionQuota(masterId);
    const capacityQuota = await this.getCapacityQuota(masterId);
    const quota = capacityQuota ?? legacyQuota;

    return {
      hasPermanentSubscription: master.hasPermanentSubscription,
      teamCount,
      distinctUserCount,
      totalUsersIncludingMaster: distinctUserCount + 1,
      includedExtraTeams: quota.includedExtraTeams,
      includedExtraUsers: quota.includedExtraUsers,
      manualAdjustmentExtraTeams: quota.manualAdjustmentExtraTeams,
      manualAdjustmentExtraUsers: quota.manualAdjustmentExtraUsers,
    };
  }

  private async getLegacyAdhesionQuota(masterId: string): Promise<BillingQuota> {
    const paidAdhesions = await prisma.backofficeAdhesion.findMany({
      where: {
        createdProfileId: masterId,
        status: "paid",
      },
      select: {
        id: true,
        extraTeams: true,
        extraUsers: true,
      },
    });
    const adhesionIds = paidAdhesions.map((adhesion) => adhesion.id);
    const now = new Date();
    const subscriptions = adhesionIds.length
      ? await prisma.backofficeUserSubscription.findMany({
          where: {
            profileId: masterId,
            adhesionId: { in: adhesionIds },
          },
          select: {
            adhesionId: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        })
      : [];
    const activeSubscriptionByAdhesionId = new Map(
      subscriptions
        .filter((subscription) => subscription.adhesionId)
        .map((subscription) => [
          subscription.adhesionId,
          subscription.status === "active" &&
            subscription.startDate <= now &&
            (!subscription.endDate || subscription.endDate >= now),
        ])
    );
    return paidAdhesions.reduce(
      (acc, adhesion) => {
        const hasActiveSubscription = activeSubscriptionByAdhesionId.get(adhesion.id);
        if (hasActiveSubscription === false) {
          return acc;
        }

        return {
          ...acc,
          includedExtraTeams: acc.includedExtraTeams + Math.max(0, adhesion.extraTeams),
          includedExtraUsers: acc.includedExtraUsers + Math.max(0, adhesion.extraUsers),
        };
      },
      {
        includedExtraTeams: 0,
        includedExtraUsers: 0,
        manualAdjustmentExtraTeams: 0,
        manualAdjustmentExtraUsers: 0,
      }
    );
  }

  private async getCapacityQuota(masterId: string): Promise<BillingQuota | null> {
    try {
      const subscription = await prisma.profileSubscription.findUnique({
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
      });

      return subscription?.capacity ?? null;
    } catch (error) {
      console.info("[BillingRepository] Capacidade dedicada indisponível, usando fallback legado.", error);
      return null;
    }
  }

  async updateAsaasCustomerId(profileId: string, asaasCustomerId: string): Promise<void> {
    await prisma.profile.update({
      where: { id: profileId },
      data: { asaasCustomerId },
    });
  }

  async updateSubscriptionData(
    profileId: string,
    data: IUpdateBillingProfileSubscriptionData
  ): Promise<void> {
    const subData = {
      asaasSubscriptionId: data.asaasSubscriptionId,
      subscriptionNextDueDate: data.subscriptionNextDueDate,
      subscriptionCycle: data.subscriptionCycle,
    };

    await prisma.profileSubscription.upsert({
      where: { profileId },
      create: { profileId, ...subData },
      update: subData,
    });

    // Keep Profile in sync for legacy compatibility
    await prisma.profile.update({
      where: { id: profileId },
      data: subData,
    });
  }

  async getSubscriptionEndDate(profileId: string): Promise<Date | null> {
    const [profileSub, profile] = await Promise.all([
      prisma.profileSubscription.findUnique({
        where: { profileId },
        select: { subscriptionEndDate: true },
      }),
      prisma.profile.findUnique({
        where: { id: profileId },
        select: { subscriptionNextDueDate: true },
      }),
    ]);

    return profileSub?.subscriptionEndDate ?? profile?.subscriptionNextDueDate ?? null;
  }
}

export const billingRepository = new PrismaBillingRepository();
