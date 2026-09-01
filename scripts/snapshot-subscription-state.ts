/**
 * Captura append-only do estado de assinatura dos masters no Postgres local.
 *
 *   bun run db:snapshot:subscription-state
 *
 * Sempre grava em LOCAL_DB_URL (`127.0.0.1:55322`). Captura no remoto só depois
 * de autorização explícita do owner (`db:migrate:push` + corrida apontada).
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { LOCAL_DB_URL } from "./lib/local-stack";
import {
  SUBSCRIPTION_STATE_SNAPSHOT_SCHEMA_VERSION,
  assembleSubscriptionStateSnapshot,
} from "../lib/billing/subscription-state-snapshot";

const prisma = new PrismaClient({ datasourceUrl: LOCAL_DB_URL });

function decimalToString(value: Prisma.Decimal | string | null): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : value.toString();
}

async function main() {
  const masters = await prisma.profile.findMany({
    where: { isMaster: true, deletedAt: null },
    select: {
      id: true,
      email: true,
      supabaseId: true,
      fullName: true,
      isMaster: true,
      hasPermanentSubscription: true,
      hasUnlimitedUsers: true,
      asaasCustomerId: true,
      asaasSubscriptionId: true,
      subscriptionId: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      subscriptionCycle: true,
      subscriptionStartDate: true,
      subscriptionEndDate: true,
      subscriptionNextDueDate: true,
      trialEndDate: true,
      operatorCount: true,
      subscription: {
        select: {
          id: true,
          adhesionId: true,
          productId: true,
          asaasSubscriptionId: true,
          asaasInstallmentId: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          subscriptionCycle: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          subscriptionNextDueDate: true,
          trialEndDate: true,
          hasPermanentSubscription: true,
          product: {
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
              featureSlugs: true,
            },
          },
          adhesion: {
            select: {
              id: true,
              status: true,
              cycle: true,
              totalAmount: true,
              monthlyTotalAmount: true,
              productId: true,
              asaasCustomerId: true,
              asaasPaymentId: true,
              asaasInstallmentId: true,
              negotiatedTotalAmount: true,
              billingType: true,
            },
          },
          capacity: {
            select: {
              includedExtraTeams: true,
              includedExtraUsers: true,
              manualAdjustmentExtraTeams: true,
              manualAdjustmentExtraUsers: true,
            },
          },
        },
      },
      userTypeAssignment: {
        select: {
          accessStartsAt: true,
          accessExpiresAt: true,
          userType: { select: { slug: true, name: true } },
        },
      },
      backofficeFeatureGrants: {
        where: { isActive: true },
        select: {
          grantType: true,
          accessLevel: true,
          feature: { select: { slug: true, name: true } },
        },
      },
    },
  });

  let inserted = 0;
  for (const master of masters) {
    const payload = assembleSubscriptionStateSnapshot({
      profile: master,
      subscription: master.subscription
        ? {
            ...master.subscription,
            adhesion: master.subscription.adhesion
              ? {
                  ...master.subscription.adhesion,
                  totalAmount: master.subscription.adhesion.totalAmount.toString(),
                  monthlyTotalAmount:
                    master.subscription.adhesion.monthlyTotalAmount.toString(),
                  negotiatedTotalAmount: decimalToString(
                    master.subscription.adhesion.negotiatedTotalAmount,
                  ),
                }
              : null,
          }
        : null,
      userType: master.userTypeAssignment
        ? {
            slug: master.userTypeAssignment.userType.slug,
            name: master.userTypeAssignment.userType.name,
            accessStartsAt: master.userTypeAssignment.accessStartsAt,
            accessExpiresAt: master.userTypeAssignment.accessExpiresAt,
          }
        : null,
      entitlements: master.backofficeFeatureGrants.map((grant) => ({
        slug: grant.feature.slug,
        name: grant.feature.name,
        grantType: grant.grantType,
        accessLevel: grant.accessLevel,
      })),
    });

    await prisma.subscriptionStateSnapshot.create({
      data: {
        profileId: master.id,
        schemaVersion: SUBSCRIPTION_STATE_SNAPSHOT_SCHEMA_VERSION,
        payload,
      },
    });
    inserted += 1;
  }

  console.info(
    `[db:snapshot:subscription-state] ${inserted} snapshot(s) em ${LOCAL_DB_URL}`,
  );
}

main()
  .catch((error) => {
    console.error(
      "[db:snapshot:subscription-state]",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
