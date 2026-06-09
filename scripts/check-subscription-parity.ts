/**
 * Read-only parity check: compares subscription fields between Profile (legacy)
 * and ProfileSubscription (new source of truth) for all master profiles.
 *
 * Usage:
 *   bun run scripts/check-subscription-parity.ts
 *
 * Exit code 0 = no divergences found (safe to proceed with DROP COLUMN)
 * Exit code 1 = divergences found or script error
 */

import { prisma } from "@/app/api/infra/data/prisma";

const FIELDS = [
  "asaasCustomerId",
  "asaasSubscriptionId",
  "subscriptionStatus",
  "subscriptionPlan",
  "subscriptionStartDate",
  "subscriptionEndDate",
  "trialEndDate",
  "subscriptionNextDueDate",
  "subscriptionCycle",
  "hasPermanentSubscription",
] as const;

type FieldName = (typeof FIELDS)[number];

interface Divergence {
  profileId: string;
  email: string | null;
  field: FieldName;
  profileValue: unknown;
  psValue: unknown;
}

function normalize(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

async function main() {
  console.info("[parity] Buscando masters com dados de assinatura...");

  const profiles = await prisma.profile.findMany({
    where: { isMaster: true },
    select: {
      id: true,
      email: true,
      asaasCustomerId: true,
      asaasSubscriptionId: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      subscriptionStartDate: true,
      subscriptionEndDate: true,
      trialEndDate: true,
      subscriptionNextDueDate: true,
      subscriptionCycle: true,
      hasPermanentSubscription: true,
      subscription: {
        select: {
          asaasCustomerId: true,
          asaasSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          trialEndDate: true,
          subscriptionNextDueDate: true,
          subscriptionCycle: true,
          hasPermanentSubscription: true,
        },
      },
    },
  });

  console.info(`[parity] ${profiles.length} master(s) encontrado(s)`);

  const divergences: Divergence[] = [];
  let noSubscriptionRow = 0;

  for (const p of profiles) {
    if (!p.subscription) {
      const hasLegacyData = FIELDS.some((f) => {
        const v = p[f as keyof typeof p];
        return v !== null && v !== undefined && v !== false;
      });
      if (hasLegacyData) {
        noSubscriptionRow++;
        console.warn(
          `[parity] SEM ProfileSubscription | profileId=${p.id} email=${p.email}`
        );
      }
      continue;
    }

    for (const field of FIELDS) {
      const pVal = normalize(p[field as keyof typeof p]);
      const psVal = normalize(p.subscription[field as keyof typeof p.subscription]);

      if (pVal !== psVal) {
        divergences.push({
          profileId: p.id,
          email: p.email,
          field,
          profileValue: p[field as keyof typeof p],
          psValue: p.subscription[field as keyof typeof p.subscription],
        });
      }
    }
  }

  if (divergences.length === 0 && noSubscriptionRow === 0) {
    console.info("[parity] ✅ PARIDADE COMPLETA — sem divergências");
    console.info("[parity] Seguro prosseguir com DROP COLUMN (com autorização do owner).");
    process.exit(0);
  }

  if (noSubscriptionRow > 0) {
    console.error(
      `[parity] ❌ ${noSubscriptionRow} master(s) com dados legacy mas SEM linha em ProfileSubscription.`
    );
    console.error("[parity] Rode o backfill migration primeiro.");
  }

  if (divergences.length > 0) {
    console.error(`[parity] ❌ ${divergences.length} divergência(s) encontrada(s):\n`);
    for (const d of divergences) {
      console.error(
        `  profileId=${d.profileId} email=${d.email} campo=${d.field}`
      );
      console.error(`    Profile (legacy): ${normalize(d.profileValue)}`);
      console.error(`    ProfileSubscription: ${normalize(d.psValue)}`);
    }
  }

  process.exit(1);
}

main().catch((err) => {
  console.error("[parity] Erro fatal:", err);
  process.exit(1);
});
