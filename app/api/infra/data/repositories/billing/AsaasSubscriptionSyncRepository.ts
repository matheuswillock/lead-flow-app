import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";

export interface AsaasSubscriptionSyncSnapshot {
  asaasSubscriptionId: string | null;
  hasPermanentSubscription: boolean;
}

export interface AsaasSubscriptionSyncData {
  asaasCustomerId?: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionCycle?: string;
  subscriptionNextDueDate?: Date;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  subscriptionLastSyncedAt: Date;
}

class PrismaAsaasSubscriptionSyncRepository {
  async getSyncSnapshot(profileId: string): Promise<AsaasSubscriptionSyncSnapshot | null> {
    const profileSubscription = await prisma.profileSubscription.findUnique({
      where: { profileId },
      select: {
        asaasSubscriptionId: true,
        hasPermanentSubscription: true,
      },
    });

    if (!profileSubscription) {
      return null;
    }

    return {
      asaasSubscriptionId: profileSubscription.asaasSubscriptionId ?? null,
      hasPermanentSubscription: profileSubscription.hasPermanentSubscription,
    };
  }

  async saveSyncData(profileId: string, asaasSubscriptionId: string, data: AsaasSubscriptionSyncData): Promise<void> {
    const subscription = await prisma.profileSubscription.upsert({
      where: { profileId },
      create: {
        profileId,
        asaasSubscriptionId,
        ...data,
      },
      update: data,
      select: { id: true },
    });

    await prisma.profile.update({
      where: { id: profileId },
      data: {
        subscriptionId: subscription.id,
      },
    });
  }
}

export const asaasSubscriptionSyncRepository = new PrismaAsaasSubscriptionSyncRepository();
