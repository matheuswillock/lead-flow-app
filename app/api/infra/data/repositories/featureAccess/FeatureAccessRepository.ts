import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeFeatureGrant,
  BackofficeUserSubscription,
  Profile,
  ProfileSubscription,
} from "@prisma/client"
import type { IFeatureAccessRepository } from "./IFeatureAccessRepository"

export class FeatureAccessRepository implements IFeatureAccessRepository {
  async listActiveFeatures() {
    return prisma.backofficeFeature.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
  }

  async findOwnerProfile(ownerProfileId: string): Promise<Pick<Profile, "hasPermanentSubscription" | "subscriptionStatus"> | null> {
    return prisma.profile.findUnique({
      where: { id: ownerProfileId },
      select: {
        hasPermanentSubscription: true,
        subscriptionStatus: true,
      },
    })
  }

  async findOwnerProfileSubscription(
    ownerProfileId: string
  ): Promise<
    (Pick<ProfileSubscription, "hasPermanentSubscription" | "subscriptionStatus"> & {
      product: { slug: string } | null
    }) | null
  > {
    return prisma.profileSubscription.findUnique({
      where: { profileId: ownerProfileId },
      select: {
        hasPermanentSubscription: true,
        subscriptionStatus: true,
        product: { select: { slug: true } },
      },
    })
  }

  async listActiveUserSubscriptions(
    profileId: string
  ): Promise<Array<BackofficeUserSubscription & { product: { slug: string } }>> {
    const now = new Date()
    return prisma.backofficeUserSubscription.findMany({
      where: {
        profileId,
        status: "active",
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        product: {
          select: { slug: true },
        },
      },
    })
  }

  async listActiveBetaGrantsForProfile(
    profileId: string
  ): Promise<Array<Pick<BackofficeFeatureGrant, "featureId">>> {
    return prisma.backofficeFeatureGrant.findMany({
      where: {
        profileId,
        grantType: "BETA",
        isActive: true,
      },
      select: { featureId: true },
    })
  }
}

