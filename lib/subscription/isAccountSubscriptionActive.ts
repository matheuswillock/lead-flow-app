import { prisma } from "@/app/api/infra/data/prisma";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trial", "past_due"]);

export type AccountSubscriptionStatus = {
  isActive: boolean;
  hasPermanentSubscription: boolean;
};

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

  const legacyStatus = profile.subscriptionStatus ?? null;
  const modernStatus = profileSubscription?.subscriptionStatus ?? null;

  const isActive =
    (legacyStatus !== null && ACTIVE_SUBSCRIPTION_STATUSES.has(legacyStatus)) ||
    (modernStatus !== null && ACTIVE_SUBSCRIPTION_STATUSES.has(modernStatus));

  return { isActive, hasPermanentSubscription: false };
}

export async function isAccountSubscriptionActive(masterProfileId: string): Promise<boolean> {
  const status = await getAccountSubscriptionStatus(masterProfileId);
  return status.isActive;
}
