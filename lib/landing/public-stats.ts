import "server-only"

import { SubscriptionStatus, UserFunction, type Prisma } from "@prisma/client"
import { prisma, withPrismaRetry } from "@/app/api/infra/data/prisma"
import { landingStatsFallback, type LandingStatsSnapshot } from "@/lib/landing/stats-data"

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

export async function getLandingStats(): Promise<LandingStatsSnapshot> {
  try {
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
  } catch (error) {
    console.error("[landing] Failed to load public stats", error)
    return landingStatsFallback
  }
}
