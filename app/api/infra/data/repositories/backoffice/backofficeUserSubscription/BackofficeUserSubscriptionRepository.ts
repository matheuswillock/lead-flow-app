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
    return prisma.backofficeUserSubscription.upsert({
      where: {
        // Use profileId + productId as the unique key for upsert
        // We identify by adhesionId if provided, otherwise fallback to create
        id: data.adhesionId
          ? await this.findIdByAdhesionId(data.adhesionId)
          : "non-existent-id-force-create",
      },
      create: {
        profileId: data.profileId,
        productId: data.productId,
        status: data.status,
        cycle: data.cycle ?? null,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        adhesionId: data.adhesionId ?? null,
      },
      update: {
        status: data.status,
        cycle: data.cycle ?? null,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
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

  private async findIdByAdhesionId(adhesionId: string): Promise<string> {
    const record = await prisma.backofficeUserSubscription.findFirst({
      where: { adhesionId },
      select: { id: true },
    })
    return record?.id ?? "non-existent-id-force-create"
  }
}
