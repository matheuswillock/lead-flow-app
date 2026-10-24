import { prisma } from "@/app/api/infra/data/prisma"

export type AsaasProfileIdentityRow = {
  readonly profileId: string
  readonly customerId: string | null
  readonly customerAccount: "primary" | "legacy"
  readonly profileSubscriptionAsaasId: string | null
  readonly profileSubscriptionAccount: "primary" | "legacy"
  readonly subscriptionRowId: string | null
  readonly subscriptionRowAsaasId: string | null
  readonly subscriptionRowAccount: "primary" | "legacy" | null
}

export interface IAsaasIdentityBackfillRepository {
  listProfiles(input: { afterId?: string; limit: number }): Promise<readonly AsaasProfileIdentityRow[]>
}

export class AsaasIdentityBackfillRepository implements IAsaasIdentityBackfillRepository {
  async listProfiles(input: { afterId?: string; limit: number }): Promise<readonly AsaasProfileIdentityRow[]> {
    const rows = await prisma.profile.findMany({
      where: {
        ...(input.afterId ? { id: { gt: input.afterId } } : {}),
        OR: [
          { asaasCustomerId: { not: null } },
          { asaasSubscriptionId: { not: null } },
          { subscription: { is: { asaasSubscriptionId: { not: null } } } },
        ],
      },
      orderBy: { id: "asc" },
      take: input.limit,
      select: {
        id: true,
        asaasCustomerId: true,
        asaasCustomerAccount: true,
        asaasSubscriptionId: true,
        asaasSubscriptionAccount: true,
        subscription: {
          select: { id: true, asaasSubscriptionId: true, asaasSubscriptionAccount: true },
        },
      },
    })
    return rows.map((row) => ({
      profileId: row.id,
      customerId: row.asaasCustomerId,
      customerAccount: row.asaasCustomerAccount,
      profileSubscriptionAsaasId: row.asaasSubscriptionId,
      profileSubscriptionAccount: row.asaasSubscriptionAccount,
      subscriptionRowId: row.subscription?.id ?? null,
      subscriptionRowAsaasId: row.subscription?.asaasSubscriptionId ?? null,
      subscriptionRowAccount: row.subscription?.asaasSubscriptionAccount ?? null,
    }))
  }
}

export const asaasIdentityBackfillRepository = new AsaasIdentityBackfillRepository()
