import type { AsaasAccount, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";

export interface AsaasSubscriptionSyncSnapshot {
  asaasSubscriptionId: string | null;
  hasPermanentSubscription: boolean;
  // DA2 (20 — Assinaturas — Backend E4). Resolvida a partir do Profile
  // (fonte confiável de qual conta o sync acabou de consultar) e gravada
  // de volta no ProfileSubscription por `saveSyncData` — achado P1 da
  // revisão do PR #1207 (thread PRRT_...CUk4): antes desta correção, o
  // `asaasSubscriptionId` era gravado sem a conta e o upsert caía no
  // `@default(primary)` do schema mesmo quando o pointer é legacy.
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

  async saveSyncData(
    profileId: string,
    asaasSubscriptionId: string,
    asaasSubscriptionAccount: AsaasAccount,
    data: AsaasSubscriptionSyncData
  ): Promise<void> {
    await prisma.profileSubscription.upsert({
      where: { profileId },
      create: {
        profileId,
        asaasSubscriptionId,
        asaasSubscriptionAccount,
        ...data,
      },
      // Regrava a conta a cada sync — auto-corretivo: já sabemos a conta
      // certa (é a que acabou de responder a este GET) e não custa nada
      // reforçá-la, inclusive em cima de uma linha mal rotulada por um
      // backfill antigo.
      update: { asaasSubscriptionAccount, ...data },
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
