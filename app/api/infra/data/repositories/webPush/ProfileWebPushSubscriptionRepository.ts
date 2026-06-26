import { prisma } from "@/app/api/infra/data/prisma";
import type {
  DeactivateWebPushSubscriptionInput,
  IProfileWebPushSubscriptionRepository,
  UpsertWebPushSubscriptionInput,
} from "./IProfileWebPushSubscriptionRepository";

export class ProfileWebPushSubscriptionRepository implements IProfileWebPushSubscriptionRepository {
  async upsertSubscription(input: UpsertWebPushSubscriptionInput): Promise<void> {
    await prisma.profileWebPushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        profileId: input.profileId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        isActive: true,
      },
      update: {
        profileId: input.profileId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        isActive: true,
      },
    });
  }

  async deactivateSubscription(input: DeactivateWebPushSubscriptionInput): Promise<void> {
    await prisma.profileWebPushSubscription.updateMany({
      where: {
        profileId: input.profileId,
        endpoint: input.endpoint,
      },
      data: { isActive: false },
    });
  }

  async findActiveByProfileId(profileId: string) {
    return prisma.profileWebPushSubscription.findMany({
      where: { profileId, isActive: true },
      select: {
        id: true,
        endpoint: true,
        p256dh: true,
        auth: true,
      },
    });
  }

  async deactivateByEndpoint(endpoint: string): Promise<void> {
    await prisma.profileWebPushSubscription.updateMany({
      where: { endpoint },
      data: { isActive: false },
    });
  }

  async findSupabaseIdByProfileId(profileId: string): Promise<string | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { supabaseId: true },
    });
    return profile?.supabaseId ?? null;
  }
}

export const profileWebPushSubscriptionRepository = new ProfileWebPushSubscriptionRepository();
