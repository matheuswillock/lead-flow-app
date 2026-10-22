import { prisma } from "@/app/api/infra/data/prisma"
import type { IAsaasProfileLookupRepository } from "./IAsaasProfileLookupRepository"

export class AsaasProfileLookupRepository implements IAsaasProfileLookupRepository {
  async findProfileId(input: {
    account: "primary" | "legacy"
    subscriptionId?: string | null
    customerId?: string | null
  }) {
    if (input.subscriptionId) {
      const bySubscription = await prisma.profileSubscription.findFirst({
        where: { asaasSubscriptionId: input.subscriptionId, asaasSubscriptionAccount: input.account },
        select: { id: true, profileId: true },
      })
      if (bySubscription) return { profileId: bySubscription.profileId, subscriptionId: bySubscription.id }
      const profileBySubscription = await prisma.profile.findFirst({
        where: { asaasSubscriptionId: input.subscriptionId, asaasSubscriptionAccount: input.account },
        select: { id: true, subscription: { select: { id: true } } },
      })
      if (profileBySubscription) {
        return {
          profileId: profileBySubscription.id,
          subscriptionId: profileBySubscription.subscription?.id ?? null,
        }
      }
    }
    if (!input.customerId) return null
    const byCustomer = await prisma.profile.findFirst({
      where: { asaasCustomerId: input.customerId, asaasCustomerAccount: input.account },
      select: { id: true, subscription: { select: { id: true } } },
    })
    if (!byCustomer) return null
    return { profileId: byCustomer.id, subscriptionId: byCustomer.subscription?.id ?? null }
  }
}

export const asaasProfileLookupRepository = new AsaasProfileLookupRepository()
