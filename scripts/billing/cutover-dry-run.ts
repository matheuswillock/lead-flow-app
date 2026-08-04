/**
 * Estágio 5 / D13 — dry-run de cutover Profile → ProfileSubscription.
 *
 * Uso:
 *   bun run scripts/billing/cutover-dry-run.ts
 *   bun run scripts/billing/cutover-dry-run.ts --apply   # requer BILLING_CUTOVER_APPLY=1
 *
 * Sem mutação por padrão. Relatório JSON em stdout.
 */

import { prisma } from "../../app/api/infra/data/prisma";

type Anomaly = {
  profileId: string;
  email: string | null;
  code: string;
  detail: string;
};

async function main() {
  const apply = process.argv.includes("--apply");
  if (apply && process.env.BILLING_CUTOVER_APPLY !== "1") {
    console.error("Recusado: --apply exige BILLING_CUTOVER_APPLY=1 (auth owner).");
    process.exit(1);
  }

  const masters = await prisma.profile.findMany({
    where: {
      isMaster: true,
      OR: [
        { subscriptionId: { not: null } },
        { asaasSubscriptionId: { not: null } },
        { subscriptionStatus: { not: null } },
        { hasPermanentSubscription: true },
      ],
    },
    select: {
      id: true,
      email: true,
      subscriptionId: true,
      asaasSubscriptionId: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      subscriptionCycle: true,
      subscriptionStartDate: true,
      subscriptionEndDate: true,
      subscriptionNextDueDate: true,
      hasPermanentSubscription: true,
      subscription: {
        select: {
          id: true,
          asaasSubscriptionId: true,
          subscriptionStatus: true,
          hasPermanentSubscription: true,
          productId: true,
        },
      },
    },
  });

  const anomalies: Anomaly[] = [];
  let missingPs = 0;
  let alreadySynced = 0;
  let wouldCreate = 0;
  let wouldUpdate = 0;

  for (const m of masters) {
    const asaasId = m.asaasSubscriptionId || m.subscriptionId;
    if (!m.subscription) {
      missingPs += 1;
      wouldCreate += 1;
      if (!asaasId && !m.hasPermanentSubscription) {
        anomalies.push({
          profileId: m.id,
          email: m.email,
          code: "NO_ASAAS_ID",
          detail: "Master com status/plano mas sem asaasSubscriptionId/subscriptionId",
        });
      }
      continue;
    }

    alreadySynced += 1;
    const ps = m.subscription;
    if (
      (asaasId && ps.asaasSubscriptionId !== asaasId) ||
      (m.subscriptionStatus && ps.subscriptionStatus !== m.subscriptionStatus) ||
      m.hasPermanentSubscription !== ps.hasPermanentSubscription
    ) {
      wouldUpdate += 1;
      anomalies.push({
        profileId: m.id,
        email: m.email,
        code: "PROFILE_PS_DIVERGE",
        detail: `Profile vs PS diverge (status/plan/asaas/permanent)`,
      });
    }
  }

  const report = {
    dryRun: !apply,
    mastersScanned: masters.length,
    missingProfileSubscription: missingPs,
    alreadyHavePs: alreadySynced,
    wouldCreate,
    wouldUpdate,
    anomaliesCount: anomalies.length,
    anomalies: anomalies.slice(0, 100),
    note: "Aplicação real exige revisão do owner + BILLING_CUTOVER_APPLY=1. Sem push remoto de migration de dados sem auth.",
  };

  console.info(JSON.stringify(report, null, 2));

  if (apply) {
    for (const m of masters) {
      if (m.subscription) continue;
      await prisma.profileSubscription.create({
        data: {
          profileId: m.id,
          asaasSubscriptionId: m.asaasSubscriptionId || m.subscriptionId,
          subscriptionStatus: m.subscriptionStatus,
          subscriptionPlan: m.subscriptionPlan,
          subscriptionCycle: m.subscriptionCycle,
          subscriptionStartDate: m.subscriptionStartDate,
          subscriptionEndDate: m.subscriptionEndDate,
          subscriptionNextDueDate: m.subscriptionNextDueDate,
          hasPermanentSubscription: m.hasPermanentSubscription,
        },
      });
    }
    console.info("[cutover] apply concluído — ProfileSubscription criados onde faltavam");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
