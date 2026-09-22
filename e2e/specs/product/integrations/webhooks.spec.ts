/**
 * app/[supabaseId]/integrations/webhooks/page.tsx
 *
 * SPEC 15 (Hub de Integrações) — T-15.5, T-15.7.
 *
 * B-E2 nesta onda cobre só a entrada e saída lado a lado com contadores e
 * links para as listas. O resumo só leitura do widget legado "Webhook
 * Genérico de Leads" (DA2) depende da unificação da SPEC 10 A-E1 e está
 * marcado `[!]` na tabela de completude da SPEC 15 — por isso esta spec NÃO
 * assere a presença desse resumo.
 */

import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../../support/db";
import { runResponsiveChecks } from "../../../support/responsive";

const INBOUND_WEBHOOK_ID = "e2e30000-0000-4000-8000-000000000301";
const OUTBOUND_WEBHOOK_ID = "e2e30000-0000-4000-8000-000000000302";

async function grantIntegrationBeta(profileId: string) {
  const prisma = getPrisma();
  const feature = await prisma.backofficeFeature.findUnique({ where: { slug: "integration" }, select: { id: true } });
  if (!feature) {
    throw new Error("Feature integration ausente no catálogo — rode `bun run db:seed:e2e`");
  }

  await prisma.backofficeFeatureGrant.upsert({
    where: {
      featureId_profileId_grantType: { featureId: feature.id, profileId, grantType: "BETA" },
    },
    create: { featureId: feature.id, profileId, grantType: "BETA", isActive: true, betaTeamScope: "ALL_TEAMS" },
    update: { isActive: true, betaTeamScope: "ALL_TEAMS" },
  });
}

async function arrangeWebhooks(teamId: string, updatedByProfileId: string) {
  const prisma = getPrisma();
  await prisma.teamWebhook.deleteMany({ where: { id: { in: [INBOUND_WEBHOOK_ID, OUTBOUND_WEBHOOK_ID] } } });

  await prisma.teamWebhook.create({
    data: {
      id: INBOUND_WEBHOOK_ID,
      teamId,
      direction: "inbound",
      status: "active",
      name: "Webhook de entrada E2E",
      updatedByProfileId,
    },
  });
  await prisma.teamWebhook.create({
    data: {
      id: OUTBOUND_WEBHOOK_ID,
      teamId,
      direction: "outbound",
      status: "paused",
      name: "Webhook de saída E2E",
      targetUrl: "https://example.com/hook",
      pausedAt: new Date(),
      pauseReason: "Teste E2E",
      updatedByProfileId,
    },
  });
}

test.describe("app/[supabaseId]/integrations/webhooks", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    const profile = await findE2eMasterProfile();
    if (!profile || !profile.activeTeamId) {
      throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
    }
    await grantIntegrationBeta(profile.id);
    await arrangeWebhooks(profile.activeTeamId, profile.id);
    // Evita o dialog de novidades interceptar cliques na primeira carga.
    await context.addInitScript((supabaseId: string) => {
      window.localStorage.setItem(`whats-new:seen:v1:${supabaseId}`, "true");
    }, E2E_MASTER_SUPABASE_ID);
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("mostra entrada e saída lado a lado, com contadores", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Webhooks de entrada")).toBeVisible();
    await expect(page.getByText("Webhooks de saída")).toBeVisible();
    await expect(page.getByText("1 configurado · 1 ativo")).toBeVisible();
    await expect(page.getByText("1 configurado · 1 pausado")).toBeVisible();
  });

  test("os cards navegam para as listas de entrada e saída", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks`, { waitUntil: "domcontentloaded" });

    await page.getByRole("link", { name: /Webhooks de entrada/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/inbound$`));

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /Webhooks de saída/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound$`));
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible({ timeout: 30_000 });
    await runResponsiveChecks(page);
  });
});
