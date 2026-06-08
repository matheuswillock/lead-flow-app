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
    const [profileSubscription, profile] = await Promise.all([
      prisma.profileSubscription.findUnique({
        where: { profileId },
        select: {
          asaasSubscriptionId: true,
          hasPermanentSubscription: true,
        },
      }),
      prisma.profile.findUnique({
        where: { id: profileId },
        select: {
          asaasSubscriptionId: true,
          asaasCustomerId: true,
          hasPermanentSubscription: true,
        },
      }),
    ]);

    if (!profile && !profileSubscription) return null;

    return {
      asaasSubscriptionId: profileSubscription?.asaasSubscriptionId ?? profile?.asaasSubscriptionId ?? null,
      hasPermanentSubscription:
        profileSubscription?.hasPermanentSubscription === true || profile?.hasPermanentSubscription === true,
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
        asaasCustomerId: data.asaasCustomerId,
        asaasSubscriptionId: asaasSubscriptionId,
        subscriptionStatus: data.subscriptionStatus,
        subscriptionCycle: data.subscriptionCycle,
        subscriptionNextDueDate: data.subscriptionNextDueDate,
        subscriptionStartDate: data.subscriptionStartDate,
        subscriptionEndDate: data.subscriptionEndDate,
      },
    });
  }
}

export const asaasSubscriptionSyncRepository = new PrismaAsaasSubscriptionSyncRepository();
