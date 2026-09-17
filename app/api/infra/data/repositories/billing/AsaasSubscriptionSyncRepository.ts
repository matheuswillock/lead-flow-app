import type { AsaasAccount, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";

export interface AsaasSubscriptionSyncSnapshot {
  asaasSubscriptionId: string | null;
  hasPermanentSubscription: boolean;
  // DA2 (20 — Assinaturas — Backend E4): só existe em Profile — ProfileSubscription
  // não tem coluna de conta própria.
  asaasSubscriptionAccount: AsaasAccount;
}

export interface AsaasSubscriptionSyncData {
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
          hasPermanentSubscription: true,
          asaasSubscriptionAccount: true,
        },
      }),
    ]);

    if (!profile && !profileSubscription) return null;

    return {
      asaasSubscriptionId: profileSubscription?.asaasSubscriptionId ?? profile?.asaasSubscriptionId ?? null,
      hasPermanentSubscription:
        profileSubscription?.hasPermanentSubscription === true || profile?.hasPermanentSubscription === true,
      asaasSubscriptionAccount: profile?.asaasSubscriptionAccount ?? "primary",
    };
  }

  async saveSyncData(profileId: string, asaasSubscriptionId: string, data: AsaasSubscriptionSyncData): Promise<void> {
    await prisma.profileSubscription.upsert({
      where: { profileId },
      create: {
        profileId,
        asaasSubscriptionId,
        ...data,
      },
      update: data,
    });

    await prisma.profile.update({
      where: { id: profileId },
      data: {
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
