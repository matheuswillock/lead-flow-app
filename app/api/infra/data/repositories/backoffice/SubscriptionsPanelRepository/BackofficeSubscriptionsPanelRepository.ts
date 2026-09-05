import { prisma } from "@/app/api/infra/data/prisma"
import { toBillingCycle } from "@/lib/billing/resolvePrice"
import type {
  IBackofficeSubscriptionsPanelRepository,
  PanelSubscriptionRecord,
} from "./IBackofficeSubscriptionsPanelRepository"

function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number(value.toString())
}

export class BackofficeSubscriptionsPanelRepository implements IBackofficeSubscriptionsPanelRepository {
  async findActiveMastersForPanel(): Promise<PanelSubscriptionRecord[]> {
    const masters = await prisma.profile.findMany({
      where: { isMaster: true, role: "manager", deletedAt: null },
      select: {
        id: true,
        hasPermanentSubscription: true,
        asaasSubscriptionId: true,
        asaasSubscriptionAccount: true,
        subscription: {
          select: {
            subscriptionStatus: true,
            subscriptionCycle: true,
            subscriptionNextDueDate: true,
            subscriptionEndDate: true,
            product: { select: { name: true } },
            adhesion: {
              select: {
                cycle: true,
                totalAmount: true,
                negotiatedTotalAmount: true,
              },
            },
          },
        },
      },
    })

    return masters.map((master) => {
      const subscription = master.subscription
      const cycle =
        subscription?.adhesion?.cycle ?? toBillingCycle(subscription?.subscriptionCycle ?? "") ?? null
      const chargedAmount = subscription?.adhesion
        ? decimalToNumber(subscription.adhesion.negotiatedTotalAmount ?? subscription.adhesion.totalAmount)
        : null

      return {
        profileId: master.id,
        hasPermanentSubscription: master.hasPermanentSubscription,
        subscriptionStatus: subscription?.subscriptionStatus ?? null,
        cycle,
        chargedAmount,
        nextDueDate: subscription?.subscriptionNextDueDate ?? null,
        subscriptionEndDate: subscription?.subscriptionEndDate ?? null,
        productName: subscription?.product?.name ?? null,
        asaasSubscriptionId: master.asaasSubscriptionId,
        asaasSubscriptionAccount: master.asaasSubscriptionAccount,
      }
    })
  }

  async countMemberProExternalAdhesions(): Promise<number> {
    return prisma.backofficeAdhesion.count({
      where: {
        requestedUserTypeSlug: "member_pro",
        billingType: "EXTERNAL",
        status: "paid",
      },
    })
  }
}

export const backofficeSubscriptionsPanelRepository = new BackofficeSubscriptionsPanelRepository()
