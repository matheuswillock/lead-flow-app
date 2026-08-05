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

  if (profile.hasPermanentSubscription || profileSubscription?.hasPermanentSubscription) {
    return { isActive: true, hasPermanentSubscription: true };
  }

  const modernStatus = profileSubscription?.subscriptionStatus ?? null;
  const legacyStatus = profile.subscriptionStatus ?? null;

  // Prefer PS; só usa Profile se PS ausente (cutover incompleto)
  const status = modernStatus ?? legacyStatus;
  const isActive = isActiveSubscriptionStatus(status);

  return { isActive, hasPermanentSubscription: false };
}

export async function isAccountSubscriptionActive(masterProfileId: string): Promise<boolean> {
  const status = await getAccountSubscriptionStatus(masterProfileId);
  return status.isActive;
}

export { ACTIVE_SUBSCRIPTION_STATUSES, isActiveSubscriptionStatus };
