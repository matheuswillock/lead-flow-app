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
      // 30-E3 entregou `BackofficeClient.asaasAccount`, então o ponteiro
      // deixa de entrar sem filtro (refinamento que o E1 deixou pendente).
      // Sem ele a execução da conta `legacy` classificaria TODO cliente de
      // backoffice como ORFAO — o cus_ está no banco e não existe naquela
      // conta —, e o cron diário de E7
      // (`AsaasDualAccountReconciliationUseCase`, que reconcilia as duas
      // contas) alertaria no Sentry uma vez por cliente, todo dia.
      prisma.backofficeClient.findMany({
        where: { asaasCustomerId: { not: null }, asaasAccount: account },
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
    // `ProfileSubscription.asaasSubscriptionAccount` (30-E3) é o dono certo
    // deste `sub_` — o Profile pode apontar outro, do fluxo legado direto.
    // O filtro agora vai na coluna própria, e não mais pela relação com
    // Profile. A ressalva que segurava essa troca era a ausência de
    // backfill: a coluna nasceu `not null default 'primary'`, então ler por
    // ela devolvia valor constante. Isso deixou de valer com
    // 20260918150645_backfill-legacy-account-new-pointer-columns.sql, que
    // relabela para 'legacy' todo ponteiro anterior ao cutover (achado P1 da
    // revisão). Usar Profile como proxy era aproximação boa só enquanto as
    // duas contas coincidiam por perfil — na janela dual elas divergem por
    // desenho (customer já migrado, assinatura ainda drenando na antiga), e
    // é justamente aí que o inventário precisa acertar.
    const [profileSubscriptions, fallbackProfiles] = await Promise.all([
      prisma.profileSubscription.findMany({
        where: {
          asaasSubscriptionId: { not: null },
          asaasSubscriptionAccount: account,
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
      // linha de ProfileSubscription não existe, não tem sub_, ou tem um
      // sub_ DIFERENTE do Profile — achado P2 da revisão (chatgpt-codex-
      // connector, thread PRRT_...CUk8). O filtro anterior só liberava o
      // fallback quando `subscription` era nulo/sem id, então a conta dupla
      // (os dois ponteiros não-nulos e distintos — Profile numa conta,
      // ProfileSubscription noutra) escondia o sub_ do Profile: a
      // reconciliação via API achava a assinatura real na conta certa e não
      // encontrava ninguém no banco, reportando FANTASMA falso. Sem o `OR`
      // aqui, todo profile com pointer próprio na conta pedida entra —
      // Prisma não compara duas colunas de relações diferentes no `where`
      // (mesma limitação documentada no achado do `OverdueReminderUseCase`),
      // então o dedupe por `asaasSubscriptionId` abaixo é quem evita
      // duplicata quando os dois ponteiros coincidem.
      prisma.profile.findMany({
        where: {
          asaasSubscriptionId: { not: null },
          asaasSubscriptionAccount: account,
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
