import { Profile } from '@prisma/client';
import { ISubscriptionRepository } from './ISubscriptionRepository';
import prisma from '../../prisma';

export class SubscriptionRepository implements ISubscriptionRepository {
  async findProfileByEmailOrPhone(email?: string, phone?: string): Promise<Profile | null> {
    const orConditions: Array<{ email?: string; phone?: string }> = [];
    
    if (email) orConditions.push({ email });
    if (phone) orConditions.push({ phone });

    if (orConditions.length === 0) {
      return null;
    }

    return await prisma.profile.findFirst({
      where: {
        OR: orConditions,
      },
    });
  }
}
