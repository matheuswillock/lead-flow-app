/**
 * SPEC 21 (Assinaturas — Frontend), estágio E7.
 *
 * A rota `subscription-management` fala com o Asaas indiretamente através de
 * várias camadas de backend — em vez de depender do estado real da conta
 * (que muda entre execuções e teria que ficar sincronizado com o Asaas
 * sandbox), esta spec intercepta as chamadas de API do próprio browser via
 * `page.route` (mesmo padrão já usado em `radar.spec.ts` para
 * `promote-to-lead`). Isso torna os cenários de erro (500, 404 de negócio,
 * timeout de polling) determinísticos e rápidos, sem tocar o Asaas.
 */
import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { E2E_MASTER_SUPABASE_ID } from "../../support/e2e-ids";
import { disconnectPrisma, findE2eMasterProfile } from "../../support/db";
import { WHATS_NEW_VERSION } from "../../../components/whats-new-modal";
import { runResponsiveChecks, contrastRatio } from "../../support/responsive";
import { FEATURE_SLUGS } from "../../../lib/features/feature-slugs";

const SUBSCRIPTION_PATH = `/${E2E_MASTER_SUPABASE_ID}/subscription`;

type MockBillingSummary = Record<string, number | boolean | string>;

function buildMockSubscription(overrides: Record<string, unknown> = {}) {
  const billingSummary: MockBillingSummary = {
    masterId: "e2e-master",
    hasUnlimitedUsers: false,
    teamCount: 3,
    distinctUserCount: 2,
    totalUsersIncludingMaster: 2,
    includedExtraTeams: 0,
    includedExtraUsers: 0,
    manualAdjustmentExtraTeams: 0,
    manualAdjustmentExtraUsers: 0,
    contractedExtraTeams: 2,
    contractedExtraUsers: 1,
    totalTeamSlots: 3,
    totalUserSlots: 2,
    usedTeamSlots: 3,
    usedUserSlots: 2,
    availableExtraTeams: 0,
    availableExtraUsers: 0,
    availableTeamSlots: 0,
    availableUserSlots: 0,
    removableTeamSlots: 0,
    removableUserSlots: 0,
    billableTeams: 2,
    billableUsers: 1,
    basePrice: 59.9,
    extraTeamsPrice: 59.8,
    extraUsersPrice: 19.9,
    totalPrice: 139.6,
    hasPermanentSubscription: false,
  };

  return {
    id: "sub-e2e-1",
    subscriptionAsaasId: "sub_asaas_e2e_1",
    status: "active",
    value: 139.6,
    nextDueDate: "2026-10-01",
    cycle: "MONTHLY",
    cycleLabel: "Mensal",
    subscriptionStartedAt: "2026-01-01T00:00:00.000Z",
    description: "Plano Manager + 2 times extras",
    billingType: "CREDIT_CARD",
    hasPermanentSubscription: false,
    customer: { name: "Master E2E", email: "e2e-master@example.com" },
    externalReference: "ext-ref-e2e-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    billingSummary,
    planDetails: { plan: "manager", operatorCount: 1, teamCount: 3, distinctUserCount: 2 },
    ...overrides,
  };
}

function outputJson(result: unknown, isValid = true, errorMessages: string[] = []) {
  return JSON.stringify({ isValid, successMessages: [], errorMessages, result });
}

// Path exato (não glob ambíguo): `**/subscription-management?**` também
// bateria com `/subscription-management/invoices` porque `?` no glob do
// Playwright casa qualquer caractere único, incluindo "/". Checar a URL
// dentro do handler evita depender da ordem de registro das rotas.
function isSubscriptionRootRequestUrl(url: string): boolean {
  const path = new URL(url).pathname;
  return path.endsWith("/subscription-management");
}

async function mockSubscriptionGet(page: import("@playwright/test").Page, subscription: unknown) {
  await page.route("**/subscription-management**", async (route) => {
    if (route.request().method() !== "GET" || !isSubscriptionRootRequestUrl(route.request().url())) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: outputJson(subscription),
    });
  });
}

async function mockInvoices(page: import("@playwright/test").Page, invoices: unknown[]) {
  await page.route("**/subscription-management/invoices**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: outputJson(invoices) });
  });
}

async function mockFeatureAccess(page: import("@playwright/test").Page) {
  // Determinismo: a aba "Créditos de e-mail" só aparece com
  // `canManageSubscription` true e a feature fora de beta (ou dentro do
  // Grupo Beta Radar) — mockar remove a dependência do estado real do
  // backoffice de features para esta spec.
  await page.route("**/features/access**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: outputJson({
        slugs: [FEATURE_SLUGS.EMAIL_CAMPAIGNS, FEATURE_SLUGS.EMAIL],
        betaSlugs: [],
        betaLabelSlugs: [],
        userRole: {
          isMaster: true,
          role: "master",
          functions: [],
          canCreateAccountUsers: true,
          canManageAccountTeams: true,
          userTypeSlug: "master",
          memberProActive: false,
          memberProExpiresAt: null,
        },
      }),
    });
  });
}

test.describe("app/[supabaseId]/subscription", () => {
  test.beforeEach(async ({ context, page }) => {
    const profile = await findE2eMasterProfile();
    expect(profile, "Seed E2E ausente — rode `bun run db:seed:e2e`").not.toBeNull();
    await injectE2eAuthCookie(context);
    await context.addInitScript(
      ({ supabaseId, version }: { supabaseId: string; version: string }) => {
        window.localStorage.setItem(`whats-new:seen:${version}:${supabaseId}`, "true");
      },
      { supabaseId: E2E_MASTER_SUPABASE_ID, version: WHATS_NEW_VERSION },
    );
    await mockFeatureAccess(page);
  });

  test.afterAll(async () => {
    await disconnectPrisma();
  });

  test("T-21.19: carrega sem erro, heading visível, hero com produto/ciclo/valor e zero termo CDP", async ({ page }) => {
    await mockSubscriptionGet(page, buildMockSubscription());
    await mockInvoices(page, []);

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(SUBSCRIPTION_PATH, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Assinatura" }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Plano Manager + 2 times extras")).toBeVisible();

    // O valor aparece no hero E no "Total mensal" do card de Cobrança — os
    // dois são legítimos, então o assert é escopado no hero em vez de um
    // `getByText` solto, que viola o strict mode do Playwright. Assertir os
    // dois é melhor que escolher um: eles têm de bater entre si.
    await expect(page.locator(".text-4xl").filter({ hasText: "R$ 139,60" })).toBeVisible();
    await expect(page.getByText("Total mensal").locator("xpath=following-sibling::*[1]")).toHaveText("R$ 139,60");
    await expect(page.getByText(/mensal/i).first()).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bCDP\b/);

    expect(consoleErrors, `console.error inesperado: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("DA2/T-21.3: janela dual-account — GET volta null após já ter visto assinatura → sem CTA de criar, mostra Atualizar", async ({ page }) => {
    await mockSubscriptionGet(page, buildMockSubscription());
    await mockInvoices(page, []);
    await page.goto(SUBSCRIPTION_PATH, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Plano Manager + 2 times extras")).toBeVisible({ timeout: 30_000 });

    // Simula a janela dual-account: a assinatura "some" no próximo GET. O
    // sessionStorage já guardou o `last-seen` do load anterior (sobrevive ao
    // reload, mesma aba/origem).
    await page.unroute("**/subscription-management**");
    await mockSubscriptionGet(page, null);
    await page.reload({ waitUntil: "domcontentloaded" });

    // CardTitle é um <div> (sem role="heading") — busca por texto, não por role.
    await expect(page.getByText("Atualizando sua assinatura")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Atualizar/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ir para Minha Conta" })).toHaveCount(0);
  });

  test("DA2: nunca viu assinatura neste navegador e GET volta null → CTA normal de criar assinatura", async ({ page }) => {
    await mockSubscriptionGet(page, null);
    await mockInvoices(page, []);
    await page.goto(SUBSCRIPTION_PATH, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Nenhuma assinatura ativa")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Ir para Minha Conta" })).toBeVisible();
  });

  test("T-21.5/DA3: 500 em email/credits/status → botão Comprar ausente e card de erro com retry", async ({ page }) => {
    await mockSubscriptionGet(page, buildMockSubscription());
    await mockInvoices(page, []);
    await page.route("**/email/credits/status**", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: outputJson(null, false, ["Erro interno"]) });
    });

    await page.goto(SUBSCRIPTION_PATH, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Plano Manager + 2 times extras")).toBeVisible({ timeout: 30_000 });

    const creditsTab = page.getByRole("tab", { name: "Créditos de e-mail" });
    await expect(creditsTab).toBeVisible({ timeout: 15_000 });
    await creditsTab.click();

    await expect(page.getByRole("button", { name: "Comprar" })).toHaveCount(0);
    await expect(page.getByText("Não foi possível carregar").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" }).first()).toBeVisible();
  });

  test("T-21.6/DA3: 500 em invoices → aba Faturas mostra erro com retry, nunca 'Nenhuma fatura encontrada'", async ({ page }) => {
    await mockSubscriptionGet(page, buildMockSubscription());
    await page.route("**/subscription-management/invoices**", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: outputJson(null, false, ["Erro interno"]) });
    });

    await page.goto(SUBSCRIPTION_PATH, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Plano Manager + 2 times extras")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("tab", { name: "Faturas" }).click();
    await expect(page.getByText("Não foi possível carregar suas faturas")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" }).first()).toBeVisible();
    await expect(page.getByText("Nenhuma fatura encontrada")).toHaveCount(0);
  });

  test("T-21.11: limpar o campo quantidade no dialog de créditos → submit desabilitado (NaN nunca passa)", async ({ page }) => {
    await mockSubscriptionGet(page, buildMockSubscription());
    await mockInvoices(page, []);
    await page.goto(SUBSCRIPTION_PATH, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Plano Manager + 2 times extras")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Atualizar créditos" }).click();
    const dialog = page.getByRole("dialog", { name: "Atualizar créditos" });
    await expect(dialog).toBeVisible();

    const quantityInput = dialog.getByLabel("Quantidade");
    await quantityInput.fill("");

    await expect(dialog.getByRole("button", { name: /Ir para checkout|Remover créditos/ })).toBeDisabled();
  });

  test("T-21.14/E5: fatura OVERDUE ganha botão 'Pagar fatura' apontando para invoiceUrl", async ({ page }) => {
    await mockSubscriptionGet(page, buildMockSubscription());
    await mockInvoices(page, [
      {
        id: "inv-1",
        status: "OVERDUE",
        value: 139.6,
        dueDate: "2026-08-01",
        description: "Fatura de Agosto",
        billingType: "CREDIT_CARD",
        invoiceUrl: "https://sandbox.asaas.com/i/overdue-invoice",
      },
    ]);

    await page.goto(SUBSCRIPTION_PATH, { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "Faturas" }).click();

    const payButton = page.getByRole("link", { name: "Pagar fatura" });
    await expect(payButton).toBeVisible();
    await expect(payButton).toHaveAttribute("href", "https://sandbox.asaas.com/i/overdue-invoice");
  });

  test("E5: status past_due mostra alerta com link para a aba Faturas", async ({ page }) => {
    await mockSubscriptionGet(page, buildMockSubscription({ status: "past_due" }));
    await mockInvoices(page, []);
    await page.goto(SUBSCRIPTION_PATH, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Pagamento Atrasado")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Ver faturas" }).click();
    await expect(page.getByRole("tabpanel").getByText(/Faturas|fatura/i).first()).toBeVisible();
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion (inclui Alert de cancelada)", async ({ page }) => {
    await mockSubscriptionGet(page, buildMockSubscription({ status: "canceled" }));
    await mockInvoices(page, []);
    await page.goto(SUBSCRIPTION_PATH, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Assinatura Cancelada")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Reativar Assinatura" })).toBeVisible();

    // Recarrega a página no passo de reduced-motion — asserts de estado vêm antes.
    await runResponsiveChecks(page);
  });

  test("contraste: pares de token usados na página (danger/warning/info) passam >= 4.5:1 texto", async ({ page }) => {
    await mockSubscriptionGet(page, buildMockSubscription({ status: "past_due" }));
    await mockInvoices(page, []);
    await page.goto(SUBSCRIPTION_PATH, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Pagamento Atrasado")).toBeVisible({ timeout: 30_000 });

    const alert = page.getByRole("alert").filter({ hasText: "Pagamento Atrasado" });
    const styles = await alert.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { color: computed.color, backgroundColor: computed.backgroundColor };
    });
    const ratio = contrastRatio(styles.color, styles.backgroundColor);
    expect(ratio, `contraste do Alert de pagamento atrasado: ${ratio}`).toBeGreaterThanOrEqual(4.5);
  });
});
