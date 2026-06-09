import { prisma } from '@/app/api/infra/data/prisma'
import type { Prisma, SubscriptionStatus, SubscriptionPlan } from '@prisma/client'

export interface ProfileSubscriptionData {
  asaasCustomerId?: string | null
  asaasSubscriptionId?: string | null
  asaasInstallmentId?: string | null
  subscriptionStatus?: SubscriptionStatus | null
  subscriptionPlan?: SubscriptionPlan | null
  subscriptionStartDate?: Date | null
  subscriptionEndDate?: Date | null
  trialEndDate?: Date | null
  subscriptionNextDueDate?: Date | null
  subscriptionCycle?: string | null
  subscriptionLastSyncedAt?: Date | null
  hasPermanentSubscription?: boolean
  productId?: string | null
}

export async function upsertProfileSubscription(
  profileId: string,
  data: ProfileSubscriptionData,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma
  await client.profileSubscription.upsert({
    where: { profileId },
    create: { profileId, ...data },
    update: data,
  })
}
