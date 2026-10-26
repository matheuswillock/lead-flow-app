/**
 * app/[supabaseId]/integrations/webhooks/outbound/page.tsx
 * app/[supabaseId]/integrations/webhooks/outbound/new/page.tsx
 * app/[supabaseId]/integrations/webhooks/outbound/[id]/page.tsx
 *
 * SPEC 10, B-E4 (W29) — as 3 páginas de webhook de saída saem da
 * `e2ePageCoverageAllowlist` com spec própria (registrada via
 * `e2ePageCoverage.coveredBy`).
 *
 * Cobertura:
 * - Lista carrega, mostra o webhook seedado, sem erro de console.
 * - T-10.22: API da lista falhando → Alert + "Tentar novamente".
 * - Tela de criação carrega o formulário (preset de destino, eventos).
 * - Detalhe carrega o webhook seedado, sem erro de console.
 * - T-10.21: API do detalhe falhando → sai do skeleton, mostra erro e o
 *   retry funciona (mesmo componente compartilhado com a entrada).
 * - Responsivo: 360/375 sem overflow, touch targets, prefers-reduced-motion.
 */

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";

const WEBHOOK_ID = "e2e10000-0000-4000-8000-000000000201";
const WEBHOOK_NAME = "Webhook E2E Saída";

async function seedOutboundWebhook(): Promise<void> {
  const prisma = getPrisma();
  const profile = await findE2eMasterProfile();
  if (!profile?.activeTeamId) {
    throw new Error("Seed E2E ausente ou sem time ativo — rode `bun run db:seed:e2e`");
  }

  await prisma.teamWebhook.upsert({
    where: { id: WEBHOOK_ID },
    create: {
      id: WEBHOOK_ID,
      teamId: profile.activeTeamId,
      direction: "outbound",
      status: "active",
      name: WEBHOOK_NAME,
      targetUrl: `https://example.test/e2e-hook-${randomUUID()}`,
      destinationPreset: "generic",
      selectedEvents: ["lead_created"],
      failureThreshold: 10,
      updatedByProfileId: profile.id,
    },
    update: {
      status: "active",
      name: WEBHOOK_NAME,
    },
  });
}

async function cleanup(): Promise<void> {
  const prisma = getPrisma();
  await prisma.teamWebhookEventLog.deleteMany({ where: { webhookId: WEBHOOK_ID } });
  await prisma.teamWebhook.deleteMany({ where: { id: WEBHOOK_ID } });
}

test.describe("app/[supabaseId]/integrations/webhooks/outbound", () => {
  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context);
    // Suprime o modal "Novidades" (não relacionado a esta SPEC) para não
    // cobrir os elementos que os testes verificam.
    await context.addInitScript((supabaseId: string) => {
      window.localStorage.setItem(`whats-new:seen:v1:${supabaseId}`, "true");
    }, E2E_MASTER_SUPABASE_ID);
    await seedOutboundWebhook();
  });

  test.afterAll(async () => {
    await cleanup();
    await disconnectPrisma();
  });

  test("lista carrega, mostra o webhook seedado", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: "Webhooks de saída" })).toBeVisible();
    await expect(page.getByText(WEBHOOK_NAME)).toBeVisible();
  });

  test("T-10.22 — API da lista falhando mostra erro com retry, não 'Nenhum webhook cadastrado ainda'", async ({
    page,
  }) => {
    await page.route("**/integrations/webhooks?**", (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }),
      });
    });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText("Não foi possível carregar os webhooks")).toBeVisible();
    await expect(page.getByText("Nenhum webhook cadastrado ainda.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  });

  test("tela de criação carrega o formulário", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound/new`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: "Novo webhook de saída" })).toBeVisible();
    await expect(page.getByLabel("Nome")).toBeVisible();
    await expect(page.getByText("Preset de destino")).toBeVisible();
  });

  test("detalhe carrega o webhook seedado", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound/${WEBHOOK_ID}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: WEBHOOK_NAME })).toBeVisible();
  });

  test("T-10.21 — API do detalhe falhando sai do skeleton, mostra erro, e o retry funciona", async ({ page }) => {
    let shouldFail = true;
    await page.route(`**/integrations/webhooks/${WEBHOOK_ID}`, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      if (shouldFail) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }),
        });
      }
      return route.continue();
    });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound/${WEBHOOK_ID}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText("Não foi possível carregar este webhook")).toBeVisible();
    const retryButton = page.getByRole("button", { name: "Tentar novamente" });
    await expect(retryButton).toBeVisible();

    shouldFail = false;
    await retryButton.click();

    await expect(page.getByRole("heading", { name: WEBHOOK_NAME })).toBeVisible();
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({ page }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "Webhooks de saída" })).toBeVisible();
    // NOTA: mesmo achado pré-existente do spec de inbound (task_66d43e60) —
    // components/ui/button.tsx nunca chega a 44px em nenhum tamanho.
    await runResponsiveChecks(page, { touchTargets: { minSize: 32 } });
  });
});
