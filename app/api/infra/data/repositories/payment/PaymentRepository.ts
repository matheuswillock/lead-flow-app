// app/api/infra/data/repositories/payment/PaymentRepository.ts

import { Profile, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { IPaymentRepository } from './IPaymentRepository';
import prisma from '../../prisma';

export class PaymentRepository implements IPaymentRepository {
  async findBySubscriptionId(subscriptionId: string): Promise<Profile | null> {
    // Look in ProfileSubscription (new table) first
    const sub = await prisma.profileSubscription.findFirst({
      where: { asaasSubscriptionId: subscriptionId },
      include: { profile: true },
    });
    if (sub) return sub.profile;
    // Legacy fallback for profiles that still have subscriptionId on the Profile row
    return prisma.profile.findFirst({ where: { subscriptionId } });
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
    const subData: any = { subscriptionStatus };
    if (subscriptionStartDate) subData.subscriptionStartDate = subscriptionStartDate;

    const subscription = await prisma.profileSubscription.upsert({
      where: { profileId },
      create: { profileId, ...subData },
      update: subData,
    });

    // Keep Profile in sync for legacy compatibility
    const profileData: any = {
      subscriptionId: subscription.id,
      subscriptionStatus,
    };
    if (subscriptionStartDate) profileData.subscriptionStartDate = subscriptionStartDate;
    return prisma.profile.update({ where: { id: profileId }, data: profileData });
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

    // Keep Profile in sync for legacy compatibility
    const profileData: any = {};
    if (data.asaasCustomerId !== undefined) profileData.asaasCustomerId = data.asaasCustomerId;
    if (subscription?.id) profileData.subscriptionId = subscription.id;
    if (data.subscriptionPlan !== undefined) profileData.subscriptionPlan = data.subscriptionPlan as SubscriptionPlan;
    if (data.subscriptionStatus !== undefined) profileData.subscriptionStatus = data.subscriptionStatus as SubscriptionStatus;
    if (data.subscriptionStartDate !== undefined) profileData.subscriptionStartDate = data.subscriptionStartDate;
    if (data.subscriptionEndDate !== undefined) profileData.subscriptionEndDate = data.subscriptionEndDate;
    if (Object.keys(profileData).length > 0) {
      await prisma.profile.update({ where: { id: profileId }, data: profileData });
    }

    return prisma.profile.findUniqueOrThrow({ where: { id: profileId } });
  }
}
