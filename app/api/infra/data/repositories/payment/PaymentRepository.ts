// app/api/infra/data/repositories/payment/PaymentRepository.ts

import { Profile, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
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

  async findByEmail(email: string): Promise<Profile | null> {
    return prisma.profile.findFirst({
      where: { email },
    });
  }

  async findById(id: string): Promise<Profile | null> {
    return prisma.profile.findFirst({ where: { id } });
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

  async updateSubscriptionData(
    profileId: string,
    data: {
      asaasCustomerId?: string;
      subscriptionId?: string;
      subscriptionPlan?: string;
      subscriptionStatus?: string;
      subscriptionStartDate?: Date;
      subscriptionEndDate?: Date;
    }
  ): Promise<Profile> {
    const mapped: any = {};
    if (data.asaasCustomerId !== undefined) mapped.asaasCustomerId = data.asaasCustomerId;
    if (data.subscriptionId !== undefined) mapped.subscriptionId = data.subscriptionId;
    if (data.subscriptionPlan !== undefined) mapped.subscriptionPlan = data.subscriptionPlan as SubscriptionPlan;
    if (data.subscriptionStatus !== undefined) mapped.subscriptionStatus = data.subscriptionStatus as SubscriptionStatus;
    if (data.subscriptionStartDate !== undefined) mapped.subscriptionStartDate = data.subscriptionStartDate;
    if (data.subscriptionEndDate !== undefined) mapped.subscriptionEndDate = data.subscriptionEndDate;

    return prisma.profile.update({ where: { id: profileId }, data: mapped });
  }
}
