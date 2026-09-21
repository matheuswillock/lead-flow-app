import { prisma } from "@/app/api/infra/data/prisma"
import type { AsaasAccountId } from "@/lib/asaas/asaas-account"
import type {
  DbCustomerPointer,
  DbSubscriptionPointer,
  IBillingInventoryRepository,
} from "./IBillingInventoryRepository"

/**
 * Implementação Prisma de `IBillingInventoryRepository`. Somente `findMany`
 * com `select` (nunca `include`) — nenhuma escrita, consistente com a
 * garantia read-only do script inteiro.
 *
 * Escopo por conta e fallback legado: ver o comentário da interface.
 */
export class BillingInventoryRepository implements IBillingInventoryRepository {
  async listCustomerPointers(account: AsaasAccountId): Promise<DbCustomerPointer[]> {
    const [profiles, adhesions, backofficeClients] = await Promise.all([
      prisma.profile.findMany({
        where: { asaasCustomerId: { not: null }, asaasCustomerAccount: account },
        select: { id: true, email: true, asaasCustomerId: true },
      }),
      prisma.backofficeAdhesion.findMany({
        where: { asaasCustomerId: { not: null }, asaasAccount: account },
        select: { id: true, email: true, asaasCustomerId: true },
      }),
      // BackofficeClient ainda não tem coluna de conta (nasce em 30-E3):
      // pré-cutover todos os customers vivem numa conta só, então incluir
      // sem filtro evita FANTASMA falso; refinar quando a coluna existir.
      prisma.backofficeClient.findMany({
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
      ...backofficeClients.map((c) => ({
        refId: c.id,
        source: "backofficeClient" as const,
        asaasCustomerId: c.asaasCustomerId as string,
        email: c.email,
      })),
    ]
  }

  async listSubscriptionPointers(account: AsaasAccountId): Promise<DbSubscriptionPointer[]> {
    // ProfileSubscription não tem coluna própria de conta (nasce em 30-E3);
    // o dono da conta do sub_ hoje é Profile.asaasSubscriptionAccount.
    const [profileSubscriptions, fallbackProfiles] = await Promise.all([
      prisma.profileSubscription.findMany({
        where: {
          asaasSubscriptionId: { not: null },
          profile: { asaasSubscriptionAccount: account },
        },
        select: {
          id: true,
          profileId: true,
          asaasSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionEndDate: true,
        },
      }),
      // Fallback legado (mesmo padrão de AsaasSubscriptionSyncRepository.
      // getSyncSnapshot): Profile.asaasSubscriptionId ainda vale quando a
      // linha de ProfileSubscription não existe ou não tem sub_. Sem ele,
      // assinatura viva apontada só pelo Profile viraria FANTASMA falso.
      prisma.profile.findMany({
        where: {
          asaasSubscriptionId: { not: null },
          asaasSubscriptionAccount: account,
          OR: [{ subscription: null }, { subscription: { asaasSubscriptionId: null } }],
        },
        select: {
          id: true,
          asaasSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionEndDate: true,
        },
      }),
    ])

    const pointers: DbSubscriptionPointer[] = profileSubscriptions.map((r) => ({
      refId: r.id,
      profileId: r.profileId,
      source: "profileSubscription" as const,
      asaasSubscriptionId: r.asaasSubscriptionId as string,
      subscriptionStatus: r.subscriptionStatus,
      subscriptionEndDate: r.subscriptionEndDate,
    }))

    const knownSubscriptionIds = new Set(pointers.map((p) => p.asaasSubscriptionId))

    for (const profile of fallbackProfiles) {
      const subscriptionId = profile.asaasSubscriptionId as string
      if (knownSubscriptionIds.has(subscriptionId)) continue
      knownSubscriptionIds.add(subscriptionId)
      pointers.push({
        refId: profile.id,
        profileId: profile.id,
        source: "profileFallback",
        asaasSubscriptionId: subscriptionId,
        subscriptionStatus: profile.subscriptionStatus,
        subscriptionEndDate: profile.subscriptionEndDate,
      })
    }

    return pointers
  }
}
