import { prisma } from "@/app/api/infra/data/prisma";

const shouldApply = process.argv.includes("--confirm");

async function getLegacyQuota(masterId: string) {
  const paidAdhesions = await prisma.backofficeAdhesion.findMany({
    where: {
      createdProfileId: masterId,
      status: "paid",
    },
    select: {
      id: true,
      extraTeams: true,
      extraUsers: true,
    },
  });

  const adhesionIds = paidAdhesions.map((adhesion) => adhesion.id);
  const now = new Date();
  const subscriptions = adhesionIds.length
    ? await prisma.backofficeUserProductSubscription.findMany({
        where: {
          profileId: masterId,
          adhesionId: { in: adhesionIds },
        },
        select: {
          adhesionId: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      })
    : [];

  const activeByAdhesionId = new Map(
    subscriptions
      .filter((subscription) => subscription.adhesionId)
      .map((subscription) => [
        subscription.adhesionId,
        subscription.status === "active" &&
          subscription.startDate <= now &&
          (!subscription.endDate || subscription.endDate >= now),
      ])
  );

  return paidAdhesions.reduce(
    (acc, adhesion) => {
      const active = activeByAdhesionId.get(adhesion.id);
      if (active === false) return acc;

      return {
        extraTeams: acc.extraTeams + Math.max(0, adhesion.extraTeams),
        extraUsers: acc.extraUsers + Math.max(0, adhesion.extraUsers),
      };
    },
    { extraTeams: 0, extraUsers: 0 }
  );
}

async function main() {
  if (!shouldApply) {
    console.info("Dry run. Reexecute com --confirm somente depois do deploy da migration.");
  }

  const subscriptions = await prisma.profileSubscription.findMany({
    where: {
      profile: { isMaster: true },
    },
    select: {
      id: true,
      profileId: true,
      capacity: {
        select: { id: true },
      },
    },
  });

  let processed = 0;
  for (const subscription of subscriptions) {
    const quota = await getLegacyQuota(subscription.profileId);
    processed += 1;

    console.info(
      `[${shouldApply ? "apply" : "dry-run"}] ${subscription.profileId}: teams=${quota.extraTeams}, users=${quota.extraUsers}`
    );

    if (!shouldApply) continue;

    await prisma.profileSubscriptionCapacity.upsert({
      where: { profileSubscriptionId: subscription.id },
      create: {
        profileSubscriptionId: subscription.id,
        includedExtraTeams: quota.extraTeams,
        includedExtraUsers: quota.extraUsers,
      },
      update: {
        includedExtraTeams: quota.extraTeams,
        includedExtraUsers: quota.extraUsers,
      },
    });
  }

  console.info(`ProfileSubscription processadas: ${processed}`);
}

main()
  .catch((error) => {
    console.error("[backfill-subscription-capacities]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
