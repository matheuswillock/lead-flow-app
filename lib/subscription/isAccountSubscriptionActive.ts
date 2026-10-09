import { prisma } from "@/app/api/infra/data/prisma";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  isActiveSubscriptionStatus,
} from "@/lib/billing/active-subscription-statuses";

export type AccountSubscriptionStatus = {
  isActive: boolean;
  hasPermanentSubscription: boolean;
};

/**
 * Estágio 6/8 — fonte preferencial ProfileSubscription; Profile só fallback legado.
 */
export async function getAccountSubscriptionStatus(
  masterProfileId: string
): Promise<AccountSubscriptionStatus> {
  const [profile, profileSubscription] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: masterProfileId },
      select: {
        hasPermanentSubscription: true,
        subscriptionStatus: true,
      },
    }),
    prisma.profileSubscription.findUnique({
      where: { profileId: masterProfileId },
      select: {
        subscriptionStatus: true,
        hasPermanentSubscription: true,
      },
    }),
  ]);

  if (!profile) {
    return { isActive: false, hasPermanentSubscription: false };
  }

  if (
    profileSubscription
      ? profileSubscription.hasPermanentSubscription
      : profile.hasPermanentSubscription
  ) {
    return { isActive: true, hasPermanentSubscription: true };
  }

  // ProfileSubscription é canônica inclusive quando o status ainda não foi
  // preenchido: usar Profile nesse caso reabre uma conta com estado desconhecido.
  const status = profileSubscription
    ? profileSubscription.subscriptionStatus
    : profile.subscriptionStatus;
  const isActive = isActiveSubscriptionStatus(status);

  return { isActive, hasPermanentSubscription: false };
}

export async function isAccountSubscriptionActive(masterProfileId: string): Promise<boolean> {
  const status = await getAccountSubscriptionStatus(masterProfileId);
  return status.isActive;
}

export { ACTIVE_SUBSCRIPTION_STATUSES, isActiveSubscriptionStatus };
