import { prisma } from '@/app/api/infra/data/prisma';
import type { ProfileSubscription } from '@prisma/client';

export async function getEffectiveSubscription(profileId: string): Promise<ProfileSubscription | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { isMaster: true, managerId: true },
  });
  if (!profile) return null;
  const ownerId = profile.isMaster ? profileId : profile.managerId;
  if (!ownerId) return null;
  return prisma.profileSubscription.findUnique({ where: { profileId: ownerId } });
}
