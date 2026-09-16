import { prisma } from "@/app/api/infra/data/prisma"
import type {
  DbCustomerPointer,
  DbSubscriptionPointer,
  IBillingInventoryRepository,
} from "./IBillingInventoryRepository"

/**
 * Implementação Prisma de `IBillingInventoryRepository`. Somente `findMany`
 * com `select` (nunca `include`) — nenhuma escrita, consistente com a
 * garantia read-only do script inteiro.
 */
export class BillingInventoryRepository implements IBillingInventoryRepository {
  async listCustomerPointers(): Promise<DbCustomerPointer[]> {
    const [profiles, adhesions] = await Promise.all([
      prisma.profile.findMany({
        where: { asaasCustomerId: { not: null } },
        select: { id: true, email: true, asaasCustomerId: true },
      }),
      prisma.backofficeAdhesion.findMany({
        where: { asaasCustomerId: { not: null } },
        select: { id: true, email: true, asaasCustomerId: true },
      }),
    ])

    return [
      ...profiles.map((p) => ({
        refId: p.id,
        source: "profile" as const,
        asaasCustomerId: p.asaasCustomerId as string,
        email: p.email,
      })),
      ...adhesions.map((a) => ({
        refId: a.id,
        source: "adhesion" as const,
        asaasCustomerId: a.asaasCustomerId as string,
        email: a.email,
      })),
    ]
  }

  async listSubscriptionPointers(): Promise<DbSubscriptionPointer[]> {
    const rows = await prisma.profileSubscription.findMany({
      where: { asaasSubscriptionId: { not: null } },
      select: {
        id: true,
        profileId: true,
        asaasSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionEndDate: true,
      },
    })

    return rows.map((r) => ({
      refId: r.id,
      profileId: r.profileId,
      asaasSubscriptionId: r.asaasSubscriptionId as string,
      subscriptionStatus: r.subscriptionStatus,
      subscriptionEndDate: r.subscriptionEndDate,
    }))
  }
}
