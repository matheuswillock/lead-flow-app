// app/api/infra/data/repositories/payment/PaymentRepository.ts

import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { IPaymentRepository, PaymentProfile } from './IPaymentRepository';
import prisma from '../../prisma';

export class PaymentRepository implements IPaymentRepository {
  async findBySubscriptionId(subscriptionId: string): Promise<PaymentProfile | null> {
    const sub = await prisma.profileSubscription.findFirst({
      where: { asaasSubscriptionId: subscriptionId },
      include: { profile: { include: { subscription: true } } },
    });
    return sub?.profile ?? null;
  }

  async findByAsaasCustomerId(asaasCustomerId: string): Promise<PaymentProfile | null> {
    return prisma.profile.findFirst({
      where: {
        subscription: {
          is: {
            asaasCustomerId,
          },
        },
      },
      include: { subscription: true },
    });
  }

  async findByEmail(email: string): Promise<PaymentProfile | null> {
    return prisma.profile.findFirst({
      where: { email },
      include: { subscription: true },
    });
  }

  async findById(id: string): Promise<PaymentProfile | null> {
    return prisma.profile.findFirst({
      where: { id },
      include: { subscription: true },
    });
  }

  async updateSubscriptionStatus(
    profileId: string,
    subscriptionStatus: string,
    subscriptionStartDate?: Date
  ): Promise<PaymentProfile> {
    const subData: any = { subscriptionStatus };
    if (subscriptionStartDate) subData.subscriptionStartDate = subscriptionStartDate;

    const subscription = await prisma.profileSubscription.upsert({
      where: { profileId },
      create: { profileId, ...subData },
      update: subData,
    });

    await prisma.profile.update({
      where: { id: profileId },
      data: { subscriptionId: subscription.id },
    });

    return prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
      include: { subscription: true },
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
  ): Promise<PaymentProfile> {
    // Subscription fields go to ProfileSubscription
    const subData: any = {};
    if (data.asaasCustomerId !== undefined) subData.asaasCustomerId = data.asaasCustomerId;
    if (data.subscriptionId !== undefined) subData.asaasSubscriptionId = data.subscriptionId;
    if (data.subscriptionPlan !== undefined) subData.subscriptionPlan = data.subscriptionPlan as SubscriptionPlan;
    if (data.subscriptionStatus !== undefined) subData.subscriptionStatus = data.subscriptionStatus as SubscriptionStatus;
    if (data.subscriptionStartDate !== undefined) subData.subscriptionStartDate = data.subscriptionStartDate;
    if (data.subscriptionEndDate !== undefined) subData.subscriptionEndDate = data.subscriptionEndDate;

    const subscription = Object.keys(subData).length > 0
      ? await prisma.profileSubscription.upsert({
        where: { profileId },
        create: { profileId, ...subData },
        update: subData,
      })
      : await prisma.profileSubscription.findUnique({ where: { profileId } });

    if (subscription?.id) {
      await prisma.profile.update({
        where: { id: profileId },
        data: { subscriptionId: subscription.id },
      });
    }

    return prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
      include: { subscription: true },
    });
  }
}
