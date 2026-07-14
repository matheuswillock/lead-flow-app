import { prisma } from "@/app/api/infra/data/prisma";

/**
 * Adesão anual paga ou assinatura YEARLY ativa dentro da janela start/end —
 * os dois grants de "usuários ilimitados" que sobrevivem independentemente
 * do vínculo com vitalício ou Member PRO. Compartilhado pelos caminhos que
 * limpam hasUnlimitedUsers ao expirar/remover outro grant, para que um
 * grant YEARLY não seja derrubado junto.
 */
export async function hasAnnualOrActiveYearlyUnlimitedGrant(masterId: string): Promise<boolean> {
  const now = new Date();
  const [annualAdhesion, activeYearlySubscription] = await Promise.all([
    prisma.backofficeAdhesion.findFirst({
      where: {
        createdProfileId: masterId,
        status: "paid",
        cycle: "annual",
      },
      select: { id: true },
    }),
    prisma.profileSubscription.findFirst({
      where: {
        profileId: masterId,
        subscriptionCycle: "YEARLY",
        OR: [{ subscriptionStatus: null }, { subscriptionStatus: "active" }],
        AND: [
          { OR: [{ subscriptionStartDate: null }, { subscriptionStartDate: { lte: now } }] },
          { OR: [{ subscriptionEndDate: null }, { subscriptionEndDate: { gte: now } }] },
        ],
      },
      select: { id: true },
    }),
  ]);

  return annualAdhesion !== null || activeYearlySubscription !== null;
}
