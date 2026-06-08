import type { BackofficeSubscriptionStatus, BackofficeUserProductSubscription } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeUserProductSubscriptionWithProduct,
  IBackofficeUserProductSubscriptionRepository,
  UpsertBackofficeUserProductSubscriptionInput,
} from "./IBackofficeUserSubscriptionRepository"

export class BackofficeUserProductSubscriptionRepository
  implements IBackofficeUserProductSubscriptionRepository
{
  async findByProfileId(profileId: string): Promise<BackofficeUserProductSubscriptionWithProduct[]> {
    return prisma.backofficeUserProductSubscription.findMany({
      where: { profileId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    })
  }

  async upsertForAdhesion(
    data: UpsertBackofficeUserProductSubscriptionInput
  ): Promise<BackofficeUserProductSubscription> {
    const existing = await prisma.backofficeUserProductSubscription.findFirst({
      where: {
        profileId: data.profileId,
        productId: data.productId,
      },
      select: { id: true },
    })

    if (existing) {
      return prisma.backofficeUserProductSubscription.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          cycle: data.cycle ?? null,
          startDate: data.startDate,
          endDate: data.endDate ?? null,
          adhesionId: data.adhesionId ?? null,
        },
      })
    }

    return prisma.backofficeUserProductSubscription.create({
      data: {
        profileId: data.profileId,
        productId: data.productId,
        status: data.status,
        cycle: data.cycle ?? null,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        adhesionId: data.adhesionId ?? null,
      },
    })
  }

  async updateStatus(
    id: string,
    status: BackofficeSubscriptionStatus
  ): Promise<BackofficeUserProductSubscription> {
    return prisma.backofficeUserProductSubscription.update({
      where: { id },
      data: { status },
    })
  }
}
