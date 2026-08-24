import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { SubscriptionStatus, UserFunction, type Prisma } from "@prisma/client"
import { prisma, withPrismaRetry } from "@/app/api/infra/data/prisma"
import { cacheTags } from "@/lib/cache/cacheTags"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
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

/** Uma hora e folgado para numero institucional; a tag derruba antes se precisar. */
const AVAILABLE_STATS_LIFE = { stale: 3600, revalidate: 3600, expire: 86400 }

/**
 * Vida curta de proposito na falha.
 *
 * A home e `○` (estatica). Numa pagina estatica, a validade das entradas de
 * cache que ela consome E o intervalo de revalidacao da pagina publicada. Se a
 * falha nao gerasse entrada nenhuma, a home sairia do build sem `StatsBand` e
 * sem nada agendado para reconsultar: a faixa so voltaria num redeploy ou num
 * `revalidateTag` manual. Um minuto faz a pagina se recuperar sozinha assim que
 * o banco responder, e o `expire` de 5 minutos limita a janela.
 */
const UNAVAILABLE_STATS_LIFE = { stale: 60, revalidate: 60, expire: 300 }

type LandingStatsCacheEntry =
  | { status: "ok"; snapshot: LandingStatsSnapshot }
  | { status: "unavailable" }

/**
 * Versao cacheada, consumida pela home.
 *
 * Sem isto a home ficava em Partial Prerender (`◐` no build): o shell era
 * estatico, mas cada visita ainda abria conexao e disparava as 4 consultas
 * desta funcao — 18.623 execucoes de cada uma na ultima janela medida. Com o
 * cache a pagina passa a `○` e sai do CDN sem invocar funcao.
 *
 * A falha vira entrada de cache com vida curta em vez de propagar. E o oposto
 * do que `getCachedTeamLeads` faz, e de proposito: la o consumidor e uma rota de
 * API, que responde 500 por request e tem mutacao disparando `revalidateTag`
 * para limpar. Aqui o consumidor e uma pagina estatica, onde "nao gravar nada"
 * significa congelar a ausencia da faixa no HTML publicado.
 */
export async function getCachedLandingStats(): Promise<LandingStatsCacheEntry> {
  "use cache"
  cacheTag(cacheTags.landingPublicStats())

  try {
    const snapshot = await fetchLandingStats()
    cacheLife(AVAILABLE_STATS_LIFE)
    return { status: "ok", snapshot }
  } catch (error) {
    // Interrupcao de prerender nao e falha de dado — precisa continuar subindo.
    rethrowIfPrerenderInterrupted(error)

    console.error("[landing] Failed to load public stats", error)
    cacheLife(UNAVAILABLE_STATS_LIFE)
    return { status: "unavailable" }
  }
}

/**
 * Mantem o contrato antigo (`null` em falha) para quem renderiza a home.
 * Sem número inventado como degradação: o caller esconde a seção.
 */
export async function getLandingStats(): Promise<LandingStatsSnapshot | null> {
  const entry = await getCachedLandingStats()
  return entry.status === "ok" ? entry.snapshot : null
}
