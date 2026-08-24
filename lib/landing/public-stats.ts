import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { SubscriptionStatus, UserFunction, type Prisma } from "@prisma/client"
import { prisma, withPrismaRetry } from "@/app/api/infra/data/prisma"
import { cacheTags } from "@/lib/cache/cacheTags"
import { type LandingStatsSnapshot } from "@/lib/landing/stats-data"

const activeSubscriptionStatuses = [
  SubscriptionStatus.active,
  SubscriptionStatus.trial,
  SubscriptionStatus.past_due,
]

const activeBillingProfileWhere: Prisma.ProfileWhereInput = {
  OR: [
    { hasPermanentSubscription: true },
    { subscriptionStatus: { in: activeSubscriptionStatuses } },
    {
      subscription: {
        is: {
          OR: [
            { hasPermanentSubscription: true },
            { subscriptionStatus: { in: activeSubscriptionStatuses } },
          ],
        },
      },
    },
  ],
}

/**
 * Consulta as estatisticas publicas. Propaga a falha de proposito: quem cacheia
 * nao deve gravar um resultado degradado, e quem renderiza decide o fallback.
 */
async function fetchLandingStats(): Promise<LandingStatsSnapshot> {
  const [masters, profileClosers, teamClosers, totalLeads] = await withPrismaRetry(
      () =>
        prisma.$transaction([
          prisma.profile.findMany({
            where: {
              isMaster: true,
              ...activeBillingProfileWhere,
            },
            select: { id: true },
          }),
          prisma.profile.findMany({
            where: {
              functions: { has: UserFunction.CLOSER },
              OR: [
                {
                  isMaster: true,
                  ...activeBillingProfileWhere,
                },
                {
                  manager: {
                    is: activeBillingProfileWhere,
                  },
                },
              ],
            },
            select: { id: true },
          }),
          prisma.teamMember.findMany({
            where: {
              functions: { has: UserFunction.CLOSER },
              team: {
                master: activeBillingProfileWhere,
              },
            },
            select: { profileId: true },
          }),
          prisma.lead.count(),
        ]),
      { label: "landing public stats" }
    )

  const corretores = new Set<string>()
  masters.forEach((profile) => corretores.add(profile.id))
  profileClosers.forEach((profile) => corretores.add(profile.id))
  teamClosers.forEach((member) => corretores.add(member.profileId))

  return {
    activeCorretores: corretores.size,
    totalLeads,
  }
}

/**
 * Versao cacheada, consumida pela home.
 *
 * Sem isto a home ficava em Partial Prerender (`◐` no build): o shell era
 * estatico, mas cada visita ainda abria conexao e disparava as 4 consultas
 * desta funcao — 18.623 execucoes de cada uma na ultima janela medida. Com o
 * cache a pagina passa a `○` e sai do CDN sem invocar funcao.
 *
 * Uma hora de validade e folgada para numero institucional, e a tag permite
 * derrubar antes disso se precisar.
 */
export async function getCachedLandingStats(): Promise<LandingStatsSnapshot> {
  "use cache"
  cacheTag(cacheTags.landingPublicStats())
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 })

  return await fetchLandingStats()
}

/**
 * Mantem o contrato antigo (`null` em falha) para quem nao renderiza a home.
 * A falha nao chega a ser cacheada: `getCachedLandingStats` propaga, e o Next
 * nao grava entrada quando a funcao lanca.
 */
export async function getLandingStats(): Promise<LandingStatsSnapshot | null> {
  try {
    return await getCachedLandingStats()
  } catch (error) {
    console.error("[landing] Failed to load public stats", error)
    // Sem número inventado como degradação: quem chama esconde a seção.
    return null
  }
}
