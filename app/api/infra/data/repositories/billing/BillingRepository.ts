import prisma from "@/app/api/infra/data/prisma";
import type {
  BillingSnapshot,
  IBillingRepository,
  IUpdateBillingProfileSubscriptionData,
} from "./IBillingRepository";

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

    return {
      hasPermanentSubscription: master.hasPermanentSubscription,
      teamCount,
      distinctUserCount,
      totalUsersIncludingMaster: distinctUserCount + 1,
    };
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
    await prisma.profile.update({
      where: { id: profileId },
      data: {
        asaasSubscriptionId: data.asaasSubscriptionId,
        subscriptionNextDueDate: data.subscriptionNextDueDate,
        subscriptionCycle: data.subscriptionCycle,
      },
    });
  }
}

export const billingRepository = new PrismaBillingRepository();
