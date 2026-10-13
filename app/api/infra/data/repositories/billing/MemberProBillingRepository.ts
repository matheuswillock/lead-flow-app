import { prisma } from "@/app/api/infra/data/prisma";
import { hasAnnualOrActiveYearlyUnlimitedGrant } from "@/app/api/infra/data/repositories/billing/unlimitedUsersGrantQueries";
import type { BillingOwnerProfile } from "@/app/api/shared/billing/billingOwnerProfile";

export interface MemberProAssignmentRecord {
  profileId: string;
  accessStartsAt: Date | null;
  accessExpiresAt: Date | null;
  slug: string;
}

const billingOwnerSelect = {
  id: true,
  fullName: true,
  email: true,
  cpfCnpj: true,
  phone: true,
  postalCode: true,
  address: true,
  addressNumber: true,
  neighborhood: true,
  complement: true,
  asaasCustomerId: true,
  asaasCustomerAccount: true,
  asaasSubscriptionId: true,
  asaasSubscriptionAccount: true,
  subscriptionStatus: true,
  subscriptionNextDueDate: true,
  subscriptionCycle: true,
  hasPermanentSubscription: true,
  hasUnlimitedUsers: true,
  timezone: true,
} as const;

export interface IMemberProBillingRepository {
  findUserTypeAssignment(masterId: string): Promise<MemberProAssignmentRecord | null>;
  findBillingOwner(masterId: string): Promise<BillingOwnerProfile | null>;
  clearUnlimitedUsersUnlessAnnualAdhesion(masterId: string): Promise<boolean>;
  findExpiredMemberProAssignments(now: Date): Promise<
    Array<{
      profileId: string;
      accessExpiresAt: Date | null;
      email: string;
      fullName: string | null;
    }>
  >;
  expireMemberProAssignment(profileId: string, now: Date): Promise<"expired" | "already_expired" | "skipped">;
}

export class MemberProBillingRepository implements IMemberProBillingRepository {
  async findUserTypeAssignment(masterId: string): Promise<MemberProAssignmentRecord | null> {
    const assignment = await prisma.profileUserTypeAssignment.findUnique({
      where: { profileId: masterId },
      select: {
        accessStartsAt: true,
        accessExpiresAt: true,
        userType: { select: { slug: true } },
      },
    });

    if (!assignment?.userType) {
      return null;
    }

    return {
      profileId: masterId,
      accessStartsAt: assignment.accessStartsAt,
      accessExpiresAt: assignment.accessExpiresAt,
      slug: assignment.userType.slug,
    };
  }

  async findBillingOwner(masterId: string): Promise<BillingOwnerProfile | null> {
    return prisma.profile.findUnique({
      where: { id: masterId },
      select: billingOwnerSelect,
    });
  }

  async clearUnlimitedUsersUnlessAnnualAdhesion(masterId: string): Promise<boolean> {
    const profile = await prisma.profile.findUnique({
      where: { id: masterId },
      select: { hasPermanentSubscription: true },
    });

    if (profile?.hasPermanentSubscription) {
      return false;
    }

    const hasIndependentGrant = await hasAnnualOrActiveYearlyUnlimitedGrant(masterId);

    if (hasIndependentGrant) {
      await prisma.profile.update({
        where: { id: masterId },
        data: { hasUnlimitedUsers: true },
      });
      return false;
    }

    await prisma.profile.update({
      where: { id: masterId },
      data: { hasUnlimitedUsers: false },
    });
    return true;
  }

  async findExpiredMemberProAssignments(now: Date) {
    return prisma.profileUserTypeAssignment.findMany({
      where: {
        OR: [{ accessExpiresAt: null }, { accessExpiresAt: { lte: now } }],
        userType: { slug: "member_pro" },
      },
      select: {
        profileId: true,
        accessExpiresAt: true,
        profile: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
    }).then((rows) =>
      rows.map((row) => ({
        profileId: row.profileId,
        accessExpiresAt: row.accessExpiresAt,
        email: row.profile.email,
        fullName: row.profile.fullName,
      }))
    );
  }

  async expireMemberProAssignment(
    profileId: string,
    now: Date
  ): Promise<"expired" | "already_expired" | "skipped"> {
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.profileUserTypeAssignment.findFirst({
        where: {
          profileId,
          OR: [{ accessExpiresAt: null }, { accessExpiresAt: { lte: now } }],
          userType: { slug: "member_pro" },
        },
        select: { accessExpiresAt: true },
      });

      if (!assignment) {
        return "skipped";
      }

      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: {
          subscriptionStatus: true,
          hasUnlimitedUsers: true,
          hasPermanentSubscription: true,
        },
      });
      if (!profile || profile.hasPermanentSubscription) {
        return "skipped";
      }
      const profileSubscription = await tx.profileSubscription.findUnique({
        where: { profileId },
        select: { subscriptionStatus: true },
      });

      const hasAnnualGrant = await tx.backofficeAdhesion.findFirst({
        where: { createdProfileId: profileId, status: "paid", cycle: "annual" },
        select: { id: true },
      });
      const yearlySubscription = await tx.profileSubscription.findFirst({
        where: {
          profileId,
          subscriptionCycle: "YEARLY",
          OR: [{ subscriptionStatus: null }, { subscriptionStatus: "active" }],
          AND: [
            { OR: [{ subscriptionStartDate: null }, { subscriptionStartDate: { lte: now } }] },
            { OR: [{ subscriptionEndDate: null }, { subscriptionEndDate: { gte: now } }] },
          ],
        },
        select: { id: true },
      });
      const preserveUnlimitedUsers = Boolean(hasAnnualGrant || yearlySubscription || profile?.hasPermanentSubscription);
      const before = {
        profileSubscriptionStatus: profileSubscription?.subscriptionStatus ?? null,
        profileStatus: profile?.subscriptionStatus ?? null,
        hasUnlimitedUsers: profile?.hasUnlimitedUsers ?? false,
        accessExpiresAt: assignment.accessExpiresAt?.toISOString() ?? null,
      };

      const claimed = await tx.profileUserTypeAssignment.updateMany({
        where: {
          profileId,
          OR: [{ accessExpiresAt: assignment.accessExpiresAt }, { accessExpiresAt: null }],
          userType: { slug: "member_pro" },
        },
        data: { updatedAt: now },
      });
      if (claimed.count !== 1) {
        return "skipped";
      }

      await tx.profile.update({
        where: { id: profileId },
        data: {
          subscriptionStatus: "past_due",
          hasUnlimitedUsers: preserveUnlimitedUsers,
        },
      });
      if (profileSubscription) {
        await tx.profileSubscription.update({
          where: { profileId },
          data: { subscriptionStatus: "past_due" },
        });
      }

      const changed =
        before.profileStatus !== "past_due" ||
        before.profileSubscriptionStatus !== "past_due" ||
        before.hasUnlimitedUsers !== preserveUnlimitedUsers;
      if (!changed) {
        return "already_expired";
      }

      await tx.subscriptionChangeLog.create({
        data: {
          profileId,
          source: "member_pro_expiration",
          changeType: "member_pro_expired",
          eventType: "overdue",
          before,
          after: {
            profileSubscriptionStatus: "past_due",
            profileStatus: "past_due",
            hasUnlimitedUsers: preserveUnlimitedUsers,
            accessExpiresAt: before.accessExpiresAt,
          },
          metadata: { asaasMutation: false },
        },
      });

      return "expired";
    });
  }
}

export const memberProBillingRepository = new MemberProBillingRepository();
