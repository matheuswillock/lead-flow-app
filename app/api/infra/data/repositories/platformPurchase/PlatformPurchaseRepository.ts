import { prisma } from "@/app/api/infra/data/prisma"
import type { PlatformPurchase, Prisma } from "@prisma/client"
import type {
  CreatePlatformPurchaseInput,
  IPlatformPurchaseRepository,
  UpdatePlatformPurchaseInput,
} from "./IPlatformPurchaseRepository"

export class PlatformPurchaseRepository implements IPlatformPurchaseRepository {
  async create(data: CreatePlatformPurchaseInput): Promise<PlatformPurchase> {
    return prisma.platformPurchase.create({
      data: {
        id: data.id,
        profileId: data.profileId,
        teamId: data.teamId ?? null,
        productSlug: data.productSlug,
        purchaseType: data.purchaseType,
        status: data.status ?? "pending",
        billingType: data.billingType ?? null,
        amount: data.amount,
        quantity: data.quantity ?? null,
        description: data.description ?? null,
        metadata: data.metadata ?? undefined,
        asaasPaymentId: data.asaasPaymentId ?? null,
        asaasCustomerId: data.asaasCustomerId ?? null,
        externalReference: data.externalReference,
      },
    })
  }

  async findById(id: string): Promise<PlatformPurchase | null> {
    return prisma.platformPurchase.findUnique({ where: { id } })
  }

  async findByExternalReference(externalReference: string): Promise<PlatformPurchase | null> {
    return prisma.platformPurchase.findUnique({ where: { externalReference } })
  }

  async findByAsaasPaymentId(asaasPaymentId: string): Promise<PlatformPurchase | null> {
    return prisma.platformPurchase.findUnique({ where: { asaasPaymentId } })
  }

  async update(id: string, data: UpdatePlatformPurchaseInput): Promise<PlatformPurchase> {
    const patch: Prisma.PlatformPurchaseUpdateInput = {
      ...(data.status !== undefined && { status: data.status }),
      ...(Object.prototype.hasOwnProperty.call(data, "billingType") && {
        billingType: data.billingType ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(data, "asaasPaymentId") && {
        asaasPaymentId: data.asaasPaymentId ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(data, "asaasCustomerId") && {
        asaasCustomerId: data.asaasCustomerId ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(data, "paidAt") && {
        paidAt: data.paidAt ?? null,
      }),
      ...(Object.prototype.hasOwnProperty.call(data, "appliedAt") && {
        appliedAt: data.appliedAt ?? null,
      }),
      ...(data.metadata !== undefined && { metadata: data.metadata }),
    }

    return prisma.platformPurchase.update({
      where: { id },
      data: patch,
    })
  }

  async markPaidOnce(input: {
    id: string
    asaasPaymentId: string
    paidAt?: Date
  }): Promise<PlatformPurchase | null> {
    const paidAt = input.paidAt ?? new Date()
    const updated = await prisma.platformPurchase.updateMany({
      where: {
        id: input.id,
        status: { not: "paid" },
      },
      data: {
        status: "paid",
        asaasPaymentId: input.asaasPaymentId,
        paidAt,
        appliedAt: paidAt,
      },
    })

    if (updated.count === 0) {
      return null
    }

    return this.findById(input.id)
  }
}

export const platformPurchaseRepository = new PlatformPurchaseRepository()
