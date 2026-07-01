import { prisma } from "@/app/api/infra/data/prisma";
import type { BillingOwnerProfile } from "@/app/api/shared/billing/billingOwnerProfile";

export interface MemberProAssignmentRecord {
  profileId: string;
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
  asaasSubscriptionId: true,
  subscriptionStatus: true,
  subscriptionNextDueDate: true,
  subscriptionCycle: true,
  hasPermanentSubscription: true,
  timezone: true,
} as const;

export interface IMemberProBillingRepository {
  findUserTypeAssignment(masterId: string): Promise<MemberProAssignmentRecord | null>;
  findBillingOwner(masterId: string): Promise<BillingOwnerProfile | null>;
  findExpiredMemberProAssignments(now: Date): Promise<
    Array<{
      profileId: string;
      accessExpiresAt: Date | null;
      email: string;
      fullName: string | null;
    }>
  >;
}

export class MemberProBillingRepository implements IMemberProBillingRepository {
  async findUserTypeAssignment(masterId: string): Promise<MemberProAssignmentRecord | null> {
    const assignment = await prisma.profileUserTypeAssignment.findUnique({
      where: { profileId: masterId },
      select: {
        accessExpiresAt: true,
        userType: { select: { slug: true } },
      },
    });

    if (!assignment?.userType) {
      return null;
    }

    return {
      profileId: masterId,
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

  async findExpiredMemberProAssignments(now: Date) {
    return prisma.profileUserTypeAssignment.findMany({
      where: {
        accessExpiresAt: { lte: now },
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
}

export const memberProBillingRepository = new MemberProBillingRepository();
