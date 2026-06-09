import type { SubscriptionProfile, ISubscriptionRepository } from './ISubscriptionRepository';
import prisma from '../../prisma';

export class SubscriptionRepository implements ISubscriptionRepository {
  async findProfileByEmailOrPhone(email?: string, phone?: string, cpfCnpj?: string): Promise<SubscriptionProfile | null> {
    const orConditions: Array<{ email?: string; phone?: string; cpfCnpj?: string }> = [] as any;
    
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });
    if (cpfCnpj) orConditions.push({ cpfCnpj });

    if (orConditions.length === 0) {
      return null;
    }

    return await prisma.profile.findFirst({
      where: {
        OR: orConditions,
      },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        phone: true,
        cpfCnpj: true,
        fullName: true,
        role: true,
        isMaster: true,
        managerId: true,
        operatorCount: true,
        subscription: {
          select: {
            asaasCustomerId: true,
            asaasSubscriptionId: true,
            subscriptionStatus: true,
            subscriptionStartDate: true,
            subscriptionEndDate: true,
            subscriptionNextDueDate: true,
            subscriptionPlan: true,
            subscriptionCycle: true,
            hasPermanentSubscription: true,
          },
        },
      },
    });
  }

  async findProfileById(id: string): Promise<SubscriptionProfile | null> {
    return await prisma.profile.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        phone: true,
        cpfCnpj: true,
        fullName: true,
        role: true,
        isMaster: true,
        managerId: true,
        operatorCount: true,
        subscription: {
          select: {
            asaasCustomerId: true,
            asaasSubscriptionId: true,
            subscriptionStatus: true,
            subscriptionStartDate: true,
            subscriptionEndDate: true,
            subscriptionNextDueDate: true,
            subscriptionPlan: true,
            subscriptionCycle: true,
            hasPermanentSubscription: true,
          },
        },
      },
    });
  }
}
