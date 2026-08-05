import { prisma } from "@/app/api/infra/data/prisma";
import type { Prisma } from "@prisma/client";

export type PastDueSubscriptionRow = {
  profileId: string;
  asaasSubscriptionId: string | null;
  subscriptionStartDate: Date | null;
  updatedAt: Date;
  profile: {
    email: string;
    fullName: string | null;
    supabaseId: string | null;
    timezone: string;
  };
};

class BillingEngineRepository {
  async findPastDueSubscriptions(params: {
    windowStart: Date;
    take: number;
  }): Promise<PastDueSubscriptionRow[]> {
    return prisma.profileSubscription.findMany({
      where: {
        subscriptionStatus: "past_due",
        hasPermanentSubscription: false,
        updatedAt: { lte: new Date(), gte: params.windowStart },
      },
      select: {
        profileId: true,
        asaasSubscriptionId: true,
        subscriptionStartDate: true,
        updatedAt: true,
        profile: {
          select: { email: true, fullName: true, supabaseId: true, timezone: true },
        },
      },
      take: params.take,
    });
  }

  async findProfileSubscriptionForPastDue(profileId: string) {
    return prisma.profileSubscription.findUnique({
      where: { profileId },
      select: {
        subscriptionStatus: true,
        updatedAt: true,
        asaasSubscriptionId: true,
      },
    });
  }

  async findProfileBillingDates(profileId: string) {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: { subscriptionStatus: true, updatedAt: true },
    });
  }

  async findAdhesionDiscount(adhesionId: string) {
    return prisma.backofficeAdhesion.findUnique({
      where: { id: adhesionId },
      select: {
        id: true,
        discountPercent: true,
        discountStatus: true,
        totalAmount: true,
        negotiatedTotalAmount: true,
      },
    });
  }

  async updateAdhesionDiscount(
    adhesionId: string,
    data: Prisma.BackofficeAdhesionUpdateInput
  ) {
    return prisma.backofficeAdhesion.update({
      where: { id: adhesionId },
      data,
    });
  }

  async findProfileForTransition(profileId: string) {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        asaasSubscriptionId: true,
        subscriptionId: true,
        subscription: { select: { id: true, asaasSubscriptionId: true, productId: true } },
        userTypeAssignment: {
          select: { userType: { select: { slug: true } } },
        },
      },
    });
  }

  async findUserTypeBySlug(slug: string) {
    return prisma.profileUserType.findFirst({
      where: { slug },
      select: { id: true },
    });
  }

  async upsertUserTypeAssignment(params: {
    profileId: string;
    userTypeId: string;
    assignedByProfileId: string;
  }) {
    return prisma.profileUserTypeAssignment.upsert({
      where: { profileId: params.profileId },
      create: {
        profileId: params.profileId,
        userTypeId: params.userTypeId,
        assignedByProfileId: params.assignedByProfileId,
      },
      update: {
        userTypeId: params.userTypeId,
        assignedByProfileId: params.assignedByProfileId,
      },
    });
  }

  async findProductsByFeatureSlugs(slugs: string[]) {
    return prisma.backofficeProduct.findMany({
      where: {
        isActive: true,
        OR: slugs.map((slug) => ({ featureSlugs: { has: slug } })),
      },
      select: { id: true, featureSlugs: true },
    });
  }

  async upsertUserProductSubscription(params: {
    profileId: string;
    productId: string;
  }) {
    return prisma.backofficeUserSubscription.upsert({
      where: {
        profileId_productId: {
          profileId: params.profileId,
          productId: params.productId,
        },
      },
      create: {
        profileId: params.profileId,
        productId: params.productId,
        status: "active",
        startDate: new Date(),
      },
      update: { status: "active" },
    });
  }

  async upsertProfileSubscriptionProduct(params: {
    profileId: string;
    productId: string;
  }) {
    return prisma.profileSubscription.upsert({
      where: { profileId: params.profileId },
      create: {
        profileId: params.profileId,
        productId: params.productId,
        subscriptionStatus: "active",
      },
      update: { productId: params.productId },
    });
  }

  async createChangeLog(data: Prisma.SubscriptionChangeLogCreateInput) {
    return prisma.subscriptionChangeLog.create({ data });
  }

  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const billingEngineRepository = new BillingEngineRepository();
