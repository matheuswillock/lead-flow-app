/**
 * Prisma helper for E2E arrange/assert.
 *
 * Uses DATABASE_URL from the environment. Does not seed — that lives in
 * scripts/seed-e2e.ts (`bun run db:seed:e2e`). Call disconnectPrisma() from
 * afterAll when a spec opens a client.
 *
 * Isolation: the first suite runs with 1 Playwright worker (see playwright.config.ts).
 * To reset between suites, re-run `bun run db:seed:e2e` (upserts the master E2E).
 */

import { PrismaClient } from "@prisma/client";
import { E2E_MASTER_SUPABASE_ID } from "../../lib/e2e/constants";

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (prisma) {
    return prisma;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("[e2e] DATABASE_URL is required for Prisma arrange/assert");
  }

  prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  return prisma;
}

export async function findProfileBySupabaseId(supabaseId: string) {
  return getPrisma().profile.findUnique({
    where: { supabaseId },
    select: {
      id: true,
      email: true,
      supabaseId: true,
      fullName: true,
      role: true,
      isMaster: true,
      activeTeamId: true,
      hasPermanentSubscription: true,
    },
  });
}

export async function findE2eMasterProfile() {
  return findProfileBySupabaseId(E2E_MASTER_SUPABASE_ID);
}

export async function disconnectPrisma(): Promise<void> {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  prisma = undefined;
}
