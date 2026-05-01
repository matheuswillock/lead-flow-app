import type { BackofficeSubscriptionStatus, BackofficeUserSubscription } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeUserSubscriptionWithProduct,
  IBackofficeUserSubscriptionRepository,
  UpsertBackofficeUserSubscriptionInput,
} from "./IBackofficeUserSubscriptionRepository"

export class BackofficeUserSubscriptionRepository
  implements IBackofficeUserSubscriptionRepository
{
  async findByProfileId(profileId: string): Promise<BackofficeUserSubscriptionWithProduct[]> {
    return prisma.backofficeUserSubscription.findMany({
      where: { profileId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    })
  }

  async upsertForAdhesion(
    data: UpsertBackofficeUserSubscriptionInput
  ): Promise<BackofficeUserSubscription> {
    const existing = await prisma.backofficeUserSubscription.findFirst({
      where: {
        profileId: data.profileId,
        productId: data.productId,
      },
      select: { id: true },
    })

    if (existing) {
      return prisma.backofficeUserSubscription.update({
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

    return prisma.backofficeUserSubscription.create({
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
  ): Promise<BackofficeUserSubscription> {
    return prisma.backofficeUserSubscription.update({
      where: { id },
      data: { status },
    })
  }
}
