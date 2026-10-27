/**
 * app/[supabaseId]/integrations/webhooks/outbound/new/page.tsx
 * app/[supabaseId]/integrations/webhooks/outbound/[id]/page.tsx
 *
 * Complementa `integrations-webhooks-outbound.spec.ts` (SPEC 10), que cobre as
 * três páginas de saída (lista, criação, detalhe).
 *
 * SPEC 20 — Webhooks de Saída. T-20.8: criar um webhook de saída revela o
 * segredo de assinatura uma única vez, com o guia de verificação visível.
 * T-20.9: o detalhe de uma entrega falha mostra payload, status HTTP e
 * resposta. T-20.10 (limite do botão de teste) depende do limitador da
 * SPEC 10 e não está coberto aqui.
 */

import { expect, test, type Page } from "@playwright/test";
import { WHATS_NEW_VERSION } from "@/components/whats-new-modal";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile, getPrisma } from "../../support/db";
import { acquireTeamWebhooksLock, releaseTeamWebhooksLock } from "../../support/team-webhooks-lock";
import { runResponsiveChecks } from "../../support/responsive";

const WEBHOOK_NAME_PREFIX = "E2E Webhook Saída";

async function resolveE2eTeamId(): Promise<string> {
  const profile = await findE2eMasterProfile();
  if (!profile?.activeTeamId) {
    throw new Error("Seed E2E sem time ativo — rode `bun run db:seed:e2e`");
  }
  return profile.activeTeamId;
}

async function cleanupE2eOutboundWebhooks(): Promise<void> {
  const teamId = await resolveE2eTeamId();
  await getPrisma().teamWebhook.deleteMany({
    where: { teamId, direction: "outbound", name: { startsWith: WEBHOOK_NAME_PREFIX } },
  });
}

/**
 * O formulário hidrata depois do `domcontentloaded`: um `fill` nesse intervalo se perde e o botão "Criar"
 * fica desabilitado. Repete o preenchimento até o botão habilitar, como um usuário que digita de novo.
 */
async function fillAndSubmitOutboundForm(page: Page, webhookName: string): Promise<void> {
  const createButton = page.getByRole("button", { name: "Criar" });
  await expect(async () => {
    await page.getByLabel("Nome").fill(webhookName);
    await page.getByLabel("URL de destino (HTTPS)").fill("https://example.com/e2e-webhook");
    await expect(createButton).toBeEnabled({ timeout: 1_500 });
  }).toPass({ timeout: 30_000 });
  await createButton.click();
}

test.describe("app/[supabaseId]/integrations/webhooks/outbound", () => {
  // Uma spec do grupo de webhooks por vez (lock) e todos os testes dela no mesmo worker.
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.beforeEach(async ({ context }) => {
    const profile = await findE2eMasterProfile();
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull();
    await injectE2eAuthCookie(context);
    // O modal "Novidades" cobre a tela no primeiro carregamento e bloqueia os
    // cliques (mesmo padrão de e2e/specs/product/email-configuracoes.spec.ts).
    await context.addInitScript(
      ({ version, supabaseId }: { version: string; supabaseId: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true");
      },
      { version: WHATS_NEW_VERSION, supabaseId: E2E_MASTER_SUPABASE_ID }
    );
    await cleanupE2eOutboundWebhooks();
  });

  test.afterEach(async () => {
    await cleanupE2eOutboundWebhooks();
  });

  // Esta spec conta ou cria webhooks no time E2E compartilhado; roda uma por vez com as demais do grupo.
  test.beforeAll(async () => {
    test.setTimeout(11 * 60_000);
    await acquireTeamWebhooksLock();
  });

  test.afterAll(async () => {
    releaseTeamWebhooksLock();
    await disconnectPrisma();
  });

  test("T-20.8: criar webhook de saída revela o segredo uma vez e mostra o guia de verificação", async ({
    page,
  }) => {
    const webhookName = `${WEBHOOK_NAME_PREFIX} ${Date.now()}`;

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound/new`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "Novo webhook de saída" })).toBeVisible({
      timeout: 30_000,
    });

    await fillAndSubmitOutboundForm(page, webhookName);

    await expect(page.getByRole("heading", { name: "Webhook de saída criado" })).toBeVisible({
      timeout: 30_000,
    });

    // O segredo aparece em texto puro, uma única vez, num input somente leitura.
    const secretInput = page.getByLabel("Segredo de assinatura (HMAC)");
    await expect(secretInput).toBeVisible();
    const secretValue = await secretInput.inputValue();
    expect(secretValue).toMatch(/^[0-9a-f]{64}$/);

    // O guia de verificação da assinatura está visível na mesma tela.
    await expect(page.getByRole("heading", { name: "Como verificar a assinatura" })).toBeVisible();
    await expect(page.getByText("X-Corretor-Studio-Signature")).toBeVisible();
    await expect(page.getByText("X-Corretor-Studio-Timestamp")).toBeVisible();
    await expect(page.getByText("X-Corretor-Studio-Event-Version")).toBeVisible();

    // Assert também no banco: o preview gravado nunca é o segredo completo.
    const teamId = await resolveE2eTeamId();
    const created = await getPrisma().teamWebhook.findFirst({
      where: { teamId, direction: "outbound", name: webhookName },
      select: { signingSecretCipher: true, signingSecretPreview: true },
    });
    expect(created?.signingSecretCipher).toBeTruthy();
    expect(created?.signingSecretPreview).toBeTruthy();
    expect(created?.signingSecretCipher).not.toContain(secretValue);
    expect(created?.signingSecretPreview).not.toBe(secretValue);
  });

  test("responsivo: novo webhook de saída sem overflow em 360/375, touch targets e reduced-motion", async ({
    page,
  }) => {
    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound/new`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "Novo webhook de saída" })).toBeVisible({
      timeout: 30_000,
    });
    await runResponsiveChecks(page);
  });

  test("responsivo: tela pós-criação (CTA \"Copiar\" o segredo) sem overflow, touch targets e reduced-motion", async ({
    page,
  }) => {
    const webhookName = `${WEBHOOK_NAME_PREFIX} responsivo ${Date.now()}`;

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound/new`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: "Novo webhook de saída" })).toBeVisible({
      timeout: 30_000,
    });
    await fillAndSubmitOutboundForm(page, webhookName);

    await expect(page.getByRole("heading", { name: "Webhook de saída criado" })).toBeVisible({
      timeout: 30_000,
    });
    await runResponsiveChecks(page);
  });

  test("T-20.9: detalhe de uma entrega falha mostra o payload, o status HTTP e a resposta", async ({
    page,
  }) => {
    const teamId = await resolveE2eTeamId();
    const webhookName = `${WEBHOOK_NAME_PREFIX} detalhe ${Date.now()}`;

    const webhook = await getPrisma().teamWebhook.create({
      data: {
        teamId,
        direction: "outbound",
        status: "active",
        name: webhookName,
        targetUrl: "https://example.com/e2e-webhook",
        destinationPreset: "generic",
        selectedEvents: ["lead_created"],
        updatedByProfileId: (await findE2eMasterProfile())!.id,
      },
    });

    await getPrisma().teamWebhookEventLog.create({
      data: {
        teamId,
        webhookId: webhook.id,
        direction: "outbound",
        result: "failure",
        eventKey: "lead_created",
        method: "POST",
        endpoint: "https://example.com/e2e-webhook",
        statusCode: 503,
        requestPayload: {
          id: "evt_e2e_1",
          type: "lead_created",
          version: 1,
          created_at: new Date().toISOString(),
          team_id: teamId,
          data: { lead: { id: "lead-e2e-1", name: "Cliente E2E" } },
        },
        responsePayload: { error: "upstream unavailable" },
        errorMessage: "Timeout ao entregar webhook: o destino não respondeu em 10000ms",
      },
    });

    await page.goto(`/${E2E_MASTER_SUPABASE_ID}/integrations/webhooks/outbound/${webhook.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: webhookName })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("tab", { name: "Logs" }).click();
    await expect(page.getByText("Timeout ao entregar webhook", { exact: false })).toBeVisible({
      timeout: 30_000,
    });

    // A UI entregue mostra o detalhe do log num painel inline ao selecionar a linha (o Sheet "Detalhe do
    // log" da SPEC 10 B-E3 ainda não existe). O texto de erro só aparece no painel, não na tabela.
    await page.locator("tr[role='button']").first().click();

    await expect(page.getByText("Conteúdo da requisição")).toBeVisible();
    await expect(page.getByText("503", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Timeout ao entregar webhook: o destino não respondeu em 10000ms")
    ).toBeVisible();
    await expect(page.getByText('"lead-e2e-1"')).toBeVisible();
    await expect(page.getByText('"error": "upstream unavailable"')).toBeVisible();

    await getPrisma().teamWebhook.delete({ where: { id: webhook.id } });
  });
});
