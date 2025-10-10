// app/api/infra/data/repositories/payment/PaymentRepository.ts

import { Profile } from '@prisma/client';
import { IPaymentRepository } from './IPaymentRepository';
import prisma from '../../prisma';

export class PaymentRepository implements IPaymentRepository {
  async findBySubscriptionId(subscriptionId: string): Promise<Profile | null> {
    return prisma.profile.findFirst({
      where: {
        subscriptionId,
      },
    });
  }

  async findByAsaasCustomerId(asaasCustomerId: string): Promise<Profile | null> {
    return prisma.profile.findFirst({
      where: {
        asaasCustomerId,
      },
    });
  }

  async updateSubscriptionStatus(
    profileId: string,
    subscriptionStatus: string,
    subscriptionStartDate?: Date
  ): Promise<Profile> {
    const updateData: any = {
      subscriptionStatus,
    };

    if (subscriptionStartDate) {
      updateData.subscriptionStartDate = subscriptionStartDate;
    }

    return prisma.profile.update({
      where: {
        id: profileId,
      },
      data: updateData,
    });
  }
}
