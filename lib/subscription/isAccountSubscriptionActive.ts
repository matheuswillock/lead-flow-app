import { prisma } from "@/app/api/infra/data/prisma";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  isActiveSubscriptionStatus,
} from "@/lib/billing/active-subscription-statuses";
import {
  isActiveMemberProAssignment,
  isBlockingMemberProAssignment,
} from "@/app/api/shared/billing/memberProBillingRules";

export type AccountSubscriptionStatus = {
  isActive: boolean;
  hasPermanentSubscription: boolean;
  memberProActive: boolean;
};

/**
 * Estágio 6/8 — fonte preferencial ProfileSubscription; Profile só fallback legado.
 */
export async function getAccountSubscriptionStatus(
  masterProfileId: string
): Promise<AccountSubscriptionStatus> {
  const [profile, profileSubscription, memberProAssignment] = await Promise.all([
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
    prisma.profileUserTypeAssignment.findUnique({
      where: { profileId: masterProfileId },
      select: {
        accessStartsAt: true,
        accessExpiresAt: true,
        userType: { select: { slug: true } },
      },
    }),
  ]);

  if (!profile) {
    return { isActive: false, hasPermanentSubscription: false, memberProActive: false };
  }

  const memberProActive = isActiveMemberProAssignment(
    memberProAssignment?.userType
      ? {
          slug: memberProAssignment.userType.slug,
          accessStartsAt: memberProAssignment.accessStartsAt,
          accessExpiresAt: memberProAssignment.accessExpiresAt,
        }
      : null
  );

  const memberProBlocked = isBlockingMemberProAssignment(
    memberProAssignment?.userType
      ? {
          slug: memberProAssignment.userType.slug,
          accessStartsAt: memberProAssignment.accessStartsAt,
          accessExpiresAt: memberProAssignment.accessExpiresAt,
        }
      : null
  );

  if (
    profileSubscription
      ? profileSubscription.hasPermanentSubscription
      : profile.hasPermanentSubscription
  ) {
    return { isActive: true, hasPermanentSubscription: true, memberProActive };
  }

  if (memberProBlocked) {
    return { isActive: false, hasPermanentSubscription: false, memberProActive };
  }

  // ProfileSubscription é canônica inclusive quando o status ainda não foi
  // preenchido: usar Profile nesse caso reabre uma conta com estado desconhecido.
  const status = profileSubscription
    ? profileSubscription.subscriptionStatus
    : profile.subscriptionStatus;
  const isActive = memberProActive || isActiveSubscriptionStatus(status);

  return { isActive, hasPermanentSubscription: false, memberProActive };
}

export async function isAccountSubscriptionActive(masterProfileId: string): Promise<boolean> {
  const status = await getAccountSubscriptionStatus(masterProfileId);
  return status.isActive;
}

export { ACTIVE_SUBSCRIPTION_STATUSES, isActiveSubscriptionStatus };
