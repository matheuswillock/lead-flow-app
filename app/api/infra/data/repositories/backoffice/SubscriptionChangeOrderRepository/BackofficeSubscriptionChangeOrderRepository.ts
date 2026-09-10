import { prisma } from "@/app/api/infra/data/prisma"
import type { BackofficeAdhesionBillingCycle } from "@prisma/client"
import { toBillingCycle } from "@/lib/billing/resolvePrice"
import type {
  BackofficeSubscriptionChangeOrderRecord,
  ChangeOrderMasterContext,
  ChangeOrderTargetProduct,
  CreateBackofficeSubscriptionChangeOrderData,
  IBackofficeSubscriptionChangeOrderRepository,
} from "./IBackofficeSubscriptionChangeOrderRepository"

function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number(value.toString())
}

function mapRecord(order: {
  id: string
  masterProfileId: string
  status: string
  targetProductId: string
  targetCycle: BackofficeAdhesionBillingCycle
  listAmount: { toString(): string }
  proratedAmount: { toString(): string }
  overrideAmount: { toString(): string } | null
  overrideStatus: string
  overrideApprovedByProfileId: string | null
  chargeAmount: { toString(): string }
  createdAt: Date
}): BackofficeSubscriptionChangeOrderRecord {
  return {
    id: order.id,
    masterProfileId: order.masterProfileId,
    status: order.status as BackofficeSubscriptionChangeOrderRecord["status"],
    targetProductId: order.targetProductId,
    targetCycle: order.targetCycle,
    listAmount: Number(order.listAmount.toString()),
    proratedAmount: Number(order.proratedAmount.toString()),
    overrideAmount: decimalToNumber(order.overrideAmount),
    overrideStatus: order.overrideStatus as BackofficeSubscriptionChangeOrderRecord["overrideStatus"],
    overrideApprovedByProfileId: order.overrideApprovedByProfileId,
    chargeAmount: Number(order.chargeAmount.toString()),
    createdAt: order.createdAt,
  }
}

export class BackofficeSubscriptionChangeOrderRepository implements IBackofficeSubscriptionChangeOrderRepository {
  async findMasterContext(masterProfileId: string): Promise<ChangeOrderMasterContext | null> {
    const master = await prisma.profile.findFirst({
      where: { id: masterProfileId, isMaster: true, role: "manager" },
      select: {
        hasPermanentSubscription: true,
        subscription: {
          select: {
            productId: true,
            subscriptionCycle: true,
            subscriptionNextDueDate: true,
            adhesion: { select: { cycle: true, totalAmount: true, negotiatedTotalAmount: true } },
          },
        },
      },
    })

    if (!master) return null

    const subscription = master.subscription
    const currentCycle =
      subscription?.adhesion?.cycle ?? toBillingCycle(subscription?.subscriptionCycle ?? "") ?? null
    const currentChargedAmount = subscription?.adhesion
      ? decimalToNumber(subscription.adhesion.negotiatedTotalAmount ?? subscription.adhesion.totalAmount)
      : null

    return {
      hasPermanentSubscription: master.hasPermanentSubscription,
      currentProductId: subscription?.productId ?? null,
      currentCycle,
      currentChargedAmount,
      currentPeriodEnd: subscription?.subscriptionNextDueDate ?? null,
    }
  }

  async findTargetProduct(productId: string): Promise<ChangeOrderTargetProduct | null> {
    const product = await prisma.backofficeProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        isActive: true,
        priceMonthly: true,
        priceQuarterly: true,
        priceQuadrimester: true,
        priceSemiannual: true,
        priceAnnual: true,
      },
    })

    if (!product) return null

    return {
      id: product.id,
      name: product.name,
      isActive: product.isActive,
      priceMonthly: decimalToNumber(product.priceMonthly),
      priceQuarterly: decimalToNumber(product.priceQuarterly),
      priceQuadrimester: decimalToNumber(product.priceQuadrimester),
      priceSemiannual: decimalToNumber(product.priceSemiannual),
      priceAnnual: decimalToNumber(product.priceAnnual),
    }
  }

  async create(
    data: CreateBackofficeSubscriptionChangeOrderData
  ): Promise<BackofficeSubscriptionChangeOrderRecord> {
    const created = await prisma.backofficeSubscriptionChangeOrder.create({
      data: {
        masterProfileId: data.masterProfileId,
        status: "draft",
        currentProductId: data.currentProductId,
        currentCycle: data.currentCycle ?? undefined,
        currentChargedAmount: data.currentChargedAmount,
        currentPeriodEnd: data.currentPeriodEnd,
        targetProductId: data.targetProductId,
        targetCycle: data.targetCycle,
        listAmount: data.listAmount,
        proratedAmount: data.proratedAmount,
        overrideAmount: data.overrideAmount,
        overrideStatus: data.overrideStatus,
        overrideApprovedByProfileId: data.overrideApprovedByProfileId,
        overrideApprovedAt: data.overrideApprovedAt,
        chargeAmount: data.chargeAmount,
        createdByBackofficeUserId: data.createdByBackofficeUserId,
      },
      select: {
        id: true,
        masterProfileId: true,
        status: true,
        targetProductId: true,
        targetCycle: true,
        listAmount: true,
        proratedAmount: true,
        overrideAmount: true,
        overrideStatus: true,
        overrideApprovedByProfileId: true,
        chargeAmount: true,
        createdAt: true,
      },
    })

    return mapRecord(created)
  }

  async findById(id: string): Promise<BackofficeSubscriptionChangeOrderRecord | null> {
    const order = await prisma.backofficeSubscriptionChangeOrder.findUnique({
      where: { id },
      select: {
        id: true,
        masterProfileId: true,
        status: true,
        targetProductId: true,
        targetCycle: true,
        listAmount: true,
        proratedAmount: true,
        overrideAmount: true,
        overrideStatus: true,
        overrideApprovedByProfileId: true,
        chargeAmount: true,
        createdAt: true,
      },
    })

    return order ? mapRecord(order) : null
  }

  async approveOverride(
    id: string,
    approverProfileId: string
  ): Promise<BackofficeSubscriptionChangeOrderRecord> {
    const updated = await prisma.backofficeSubscriptionChangeOrder.update({
      where: { id },
      data: {
        overrideStatus: "approved",
        overrideApprovedByProfileId: approverProfileId,
        overrideApprovedAt: new Date(),
      },
      select: {
        id: true,
        masterProfileId: true,
        status: true,
        targetProductId: true,
        targetCycle: true,
        listAmount: true,
        proratedAmount: true,
        overrideAmount: true,
        overrideStatus: true,
        overrideApprovedByProfileId: true,
        chargeAmount: true,
        createdAt: true,
      },
    })

    return mapRecord(updated)
  }
}

export const backofficeSubscriptionChangeOrderRepository = new BackofficeSubscriptionChangeOrderRepository()
