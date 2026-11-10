/**
 * app/[supabaseId]/integrations/lead-form/page.tsx
 *
 * Formulário de Captação de Leads ganhou página própria (antes era um bloco
 * fixo sem controle de acesso, embutido no fim de
 * app/[supabaseId]/integrations/page.tsx). O conteúdo (`LeadFormIntegration`)
 * não foi editado além de tirar o título/descrição duplicados pela página —
 * esta spec cobre a página nova e o fluxo de voltar para o hub.
 */

import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../../support/db";
import { runResponsiveChecks } from "../../../support/responsive";

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

test.describe("app/[supabaseId]/integrations/lead-form", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    const profile = await findE2eMasterProfile();
    if (!profile) {
      throw new Error("Seed E2E ausente — rode `bun run db:seed:e2e`");
    }
    await grantIntegrationBeta(profile.id);
    // Evita o dialog de novidades interceptar cliques na primeira carga.
    await context.addInitScript((supabaseId: string) => {
      window.localStorage.setItem(`whats-new:seen:v1:${supabaseId}`, "true");
    }, E2E_MASTER_SUPABASE_ID);
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("carrega o link do formulário e volta para o hub de Integrações", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/lead-form`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Formulário de Captação de Leads", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTitle("Copiar URL")).toBeVisible();
    await expect(page.getByTitle("Abrir formulário")).toBeVisible();

    await page.getByRole("link", { name: /Integrações/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${E2E_MASTER_SUPABASE_ID}/integrations$`));
  });

  test("o card do hub navega para a página própria", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations`, { waitUntil: "domcontentloaded" });

    await page.locator("main").getByRole("link", { name: /Formulário de Captação de Leads/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${E2E_MASTER_SUPABASE_ID}/integrations/lead-form$`));
    await expect(page.getByRole("heading", { name: "Formulário de Captação de Leads", exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/lead-form`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Formulário de Captação de Leads", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await runResponsiveChecks(page);
  });
});
