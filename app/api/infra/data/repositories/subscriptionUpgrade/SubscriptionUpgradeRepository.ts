import { prisma } from "@/app/api/infra/data/prisma";
import type { AsaasAccountId } from "@/lib/asaas";
import type { Profile } from "@prisma/client";
import type {
  CreateOperatorProfileInput,
  ISubscriptionUpgradeRepository,
  SubscriptionUpgradeManagerProfile,
  SubscriptionUpgradeOperatorProfile,
  SubscriptionUpgradePendingOperator,
  SubscriptionUpgradeProfileSubscription,
  SubscriptionUpgradeTeam,
  SubscriptionUpgradeProfileContact,
} from "./ISubscriptionUpgradeRepository";

export class SubscriptionUpgradeRepository implements ISubscriptionUpgradeRepository {
  private readonly managerSelect = {
    id: true,
    supabaseId: true,
    email: true,
    fullName: true,
    role: true,
    isMaster: true,
    asaasCustomerId: true,
    asaasCustomerAccount: true,
    asaasSubscriptionId: true,
    asaasSubscriptionAccount: true,
    subscriptionNextDueDate: true,
    subscriptionCycle: true,
    operatorCount: true,
    _count: { select: { operators: true } },
    subscriptionStatus: true,
    timezone: true,
    cpfCnpj: true,
    phone: true,
    postalCode: true,
    address: true,
    addressNumber: true,
    complement: true,
  } as const;

  private readonly operatorSelect = {
    id: true,
    supabaseId: true,
    fullName: true,
    email: true,
    role: true,
    functions: true,
    managerId: true,
    asaasSubscriptionId: true,
  } as const;

  private readonly pendingOperatorWithManagerSelect = {
    id: true,
    managerId: true,
    teamId: true,
    name: true,
    email: true,
    role: true,
    functions: true,
    paymentId: true,
    subscriptionId: true,
    paymentStatus: true,
    paymentMethod: true,
    asaasAccount: true,
    operatorCreated: true,
    operatorId: true,
    createdAt: true,
    updatedAt: true,
    manager: { select: this.managerSelect },
  } as const;

  async findManagerProfileById(managerId: string): Promise<SubscriptionUpgradeManagerProfile | null> {

    const profile = await prisma.profile.findUnique({
      where: { id: managerId },
      select: this.managerSelect,
    });

    if (!profile) return null;

    const { _count, ...manager } = profile;

    return {
      ...manager,
      operatorCount: _count?.operators ?? manager.operatorCount,
      asaasCustomerAccount: profile.asaasCustomerAccount as AsaasAccountId | null,
      asaasSubscriptionAccount: profile.asaasSubscriptionAccount as AsaasAccountId | null,
    };
  }

  async findManagerProfileBySupabaseId(supabaseId: string): Promise<SubscriptionUpgradeManagerProfile | null> {
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: this.managerSelect,
    });

    if (!profile) return null;

    const { _count, ...manager } = profile;

    return {
      ...manager,
      operatorCount: _count?.operators ?? manager.operatorCount,
      asaasCustomerAccount: profile.asaasCustomerAccount as AsaasAccountId | null,
      asaasSubscriptionAccount: profile.asaasSubscriptionAccount as AsaasAccountId | null,
    };
  }


  async updateManagerCustomerId(
    managerId: string,
    asaasCustomerId: string,
    asaasCustomerAccount: AsaasAccountId
  ): Promise<void> {
    await prisma.profile.update({
      where: { id: managerId },
      data: {
        asaasCustomerId,
        asaasCustomerAccount,
      },
    });
  }



  async provisionConfirmedOperator(input: {
    pendingOperatorId: string;
    managerId: string;
    teamId: string;
    operator: CreateOperatorProfileInput;
  }): Promise<SubscriptionUpgradeOperatorProfile> {
    return prisma.$transaction(async (tx) => {
      const operator = await tx.profile.create({
        data: input.operator,
        select: this.operatorSelect,
      });

      await tx.teamMember.create({
        data: {
          teamId: input.teamId,
          profileId: operator.id,
          role: input.operator.role,
          functions: input.operator.functions,
        },
      });

      await tx.pendingOperator.update({
        where: { id: input.pendingOperatorId },
        data: {
          operatorCreated: true,
          operatorId: operator.id,
          paymentStatus: "CONFIRMED" as any,
          updatedAt: new Date(),
        },
      });

      await tx.profile.update({
        where: { id: input.managerId },
        data: { operatorCount: { increment: 1 } },
      });

      return operator;
    });
  }

  async findProfileByEmail(email: string): Promise<SubscriptionUpgradeProfileContact | null> {
    return prisma.profile.findFirst({
      where: { email },
      select: { id: true, email: true, fullName: true },
    });
  }

  async findDefaultTeamByMasterId(masterId: string): Promise<SubscriptionUpgradeTeam | null> {
    const team = await prisma.team.findFirst({
      where: { masterId, isDefault: true, deletedAt: null },
      select: {
        id: true,
        masterId: true,
        isDefault: true,
        deletedAt: true,
        master: { select: { sponsorMasterId: true } },
      },
    });

    if (!team) return null;

    return {
      id: team.id,
      masterId: team.masterId,
      isDefault: team.isDefault,
      deletedAt: team.deletedAt,
      master: { sponsorMasterId: team.master.sponsorMasterId },
    };
  }

  async countActiveTeamsByMasterId(masterId: string): Promise<number> {
    return prisma.team.count({
      where: { masterId, deletedAt: null },
    });
  }


  // PendingOperator operations
  async createPendingOperator(input: {
    managerId: string;
    teamId: string | null;
    name: string;
    email: string;
    role: string;
    functions: import("@prisma/client").UserFunction[];
    paymentId: string;
    subscriptionId: string | null;
    paymentStatus: string;
    paymentMethod: string;
    asaasAccount: AsaasAccountId;
  }): Promise<import("@prisma/client").PendingOperator> {
    return prisma.pendingOperator.create({
      data: {
        managerId: input.managerId,
        teamId: input.teamId,
        name: input.name,
        email: input.email,
        role: input.role as any,
        functions: input.functions,
        paymentId: input.paymentId,
        subscriptionId: input.subscriptionId,
        paymentStatus: input.paymentStatus as any,
        paymentMethod: input.paymentMethod,
        asaasAccount: input.asaasAccount,
      },
    });
  }

  async findActivePendingOperatorByManagerAndEmail(
    managerId: string,
    email: string
  ): Promise<{ id: string; createdAt: Date } | null> {
    return prisma.pendingOperator.findFirst({
      where: {
        managerId,
        email,
        operatorCreated: false,
        paymentStatus: { not: "CONFIRMED" as any },
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async findPendingOperatorByPaymentIdWithManager(
    paymentId: string,
    account?: AsaasAccountId
  ): Promise<SubscriptionUpgradePendingOperator | null> {
    const pending = await prisma.pendingOperator.findFirst({
      where: account ? { paymentId, asaasAccount: account } : { paymentId },
      select: this.pendingOperatorWithManagerSelect,
    });

    if (!pending) return null;

    return {
      ...pending,
      manager: {
        ...pending.manager,
        asaasCustomerAccount: pending.manager.asaasCustomerAccount as AsaasAccountId | null,
        asaasSubscriptionAccount: pending.manager.asaasSubscriptionAccount as AsaasAccountId | null,
      },
    };
  }

  async findPendingOperatorByIdWithManager(id: string): Promise<SubscriptionUpgradePendingOperator | null> {
    const pending = await prisma.pendingOperator.findUnique({
      where: { id },
      select: this.pendingOperatorWithManagerSelect,
    });

    if (!pending) return null;

    return {
      ...pending,
      manager: {
        ...pending.manager,
        asaasCustomerAccount: pending.manager.asaasCustomerAccount as AsaasAccountId | null,
        asaasSubscriptionAccount: pending.manager.asaasSubscriptionAccount as AsaasAccountId | null,
      },
    };
  }

  async findPendingOperatorBySubscriptionId(
    subscriptionId: string
  ): Promise<SubscriptionUpgradePendingOperator | null> {
    const pending = await prisma.pendingOperator.findFirst({
      where: { subscriptionId },
      select: this.pendingOperatorWithManagerSelect,
    });

    if (!pending) return null;

    return {
      ...pending,
      manager: {
        ...pending.manager,
        asaasCustomerAccount: pending.manager.asaasCustomerAccount as AsaasAccountId | null,
        asaasSubscriptionAccount: pending.manager.asaasSubscriptionAccount as AsaasAccountId | null,
      },
    };
  }

  async findProfileById(id: string): Promise<Pick<Profile, "id" | "managerId"> | null> {
    return prisma.profile.findUnique({
      where: { id },
      select: { id: true, managerId: true },
    });
  }

  async decrementManagerOperatorCount(managerId: string): Promise<void> {
    await prisma.profile.update({
      where: { id: managerId },
      data: {
        operatorCount: { decrement: 1 },
      },
    });
  }

  async updatePendingOperatorPaymentId(
    id: string,
    paymentId: string,
    account: AsaasAccountId
  ): Promise<void> {
    await prisma.pendingOperator.update({
      where: { id },
      data: { paymentId, asaasAccount: account },
    });
  }


  async updatePendingOperatorPaymentStatus(id: string, paymentStatus: string): Promise<void> {
    await prisma.pendingOperator.update({
      where: { id },
      data: { paymentStatus: paymentStatus as any },
    });
  }

  async markPendingOperatorSubscriptionUpdated(id: string): Promise<void> {
    await prisma.pendingOperator.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }

  async deletePendingOperatorById(id: string): Promise<void> {
    await prisma.pendingOperator.delete({ where: { id } });
  }

  // ProfileSubscription operations
  async findProfileSubscriptionByProfileId(
    profileId: string
  ): Promise<SubscriptionUpgradeProfileSubscription | null> {
    const subscription = await prisma.profileSubscription.findUnique({
      where: { profileId },
      select: {
        hasPermanentSubscription: true,
        asaasSubscriptionId: true,
        asaasSubscriptionAccount: true,
        product: {
          select: {
            id: true,
            name: true,
            priceMonthly: true,
            isActive: true,
          },
        },
        capacity: {
          select: {
            includedExtraUsers: true,
            includedExtraTeams: true,
            manualAdjustmentExtraUsers: true,
            manualAdjustmentExtraTeams: true,
          },
        },
      },
    });

    if (!subscription) return null;

    return {
      ...subscription,
      asaasSubscriptionAccount: subscription.asaasSubscriptionAccount as AsaasAccountId | null,
      product: subscription.product
        ? {
            ...subscription.product,
            priceMonthly:
              subscription.product.priceMonthly === null
                ? null
                : Number(subscription.product.priceMonthly),
          }
        : null,
    };
  }

  async findProfileSubscriptionById(
    profileId: string
  ): Promise<SubscriptionUpgradeProfileSubscription | null> {
    return this.findProfileSubscriptionByProfileId(profileId);
  }
}

export const subscriptionUpgradeRepository: ISubscriptionUpgradeRepository =
  new SubscriptionUpgradeRepository();
