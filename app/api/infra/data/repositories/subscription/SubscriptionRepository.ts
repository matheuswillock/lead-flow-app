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
      include: {
        subscription: true,
      },
    });
  }

  async findProfileById(id: string): Promise<SubscriptionProfile | null> {
    return await prisma.profile.findUnique({
      where: {
        id,
      },
      include: {
        subscription: true,
      },
    });
  }
}
