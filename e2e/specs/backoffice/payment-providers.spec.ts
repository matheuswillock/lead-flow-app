import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../fixtures/auth";
import { disconnectPrisma, getPrisma } from "../../support/db";
import { runResponsiveChecks } from "../../support/responsive";

test.describe("app/backoffice/(app)/payment-providers", () => {
  test.setTimeout(120_000);

  const suffix = randomUUID().slice(0, 8);
  let profileId: string | null = null;
  let supabaseId = "";
  let email = "";

  test.beforeAll(async () => {
    const prisma = getPrisma();
    supabaseId = randomUUID();
    email = `e2e.payment-providers.${Date.now()}@example.com`;
    const profile = await prisma.profile.create({
      data: { supabaseId, email, fullName: "E2E Payment Providers", role: "backoffice" },
      select: { id: true },
    });
    profileId = profile.id;
    await prisma.backofficeUser.create({
      data: { profileId: profile.id, email, fullAccess: true, isActive: true },
    });
  });

  test.afterAll(async () => {
    const prisma = getPrisma();
    if (profileId) {
      await prisma.backofficeUser.deleteMany({ where: { profileId } }).catch(() => null);
      await prisma.profile.deleteMany({ where: { id: profileId } }).catch(() => null);
    }
    await disconnectPrisma();
  });

  test.beforeEach(async ({ context }) => {
    await injectE2eAuthCookie(context, { supabaseId, email });
  });

  test("lista instâncias e mostra apenas metadados das credenciais", async ({ page }) => {
    await page.route("**/api/q/backoffice/payment-providers/instances**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          isValid: true,
          result: [
            {
              id: "config-abacate-dev",
              provider: "ABACATE_PAY",
              environment: "DEV",
              displayName: "Abacate Pay · testes",
              externalAccountContext: "primary",
              isDefault: true,
              isSelectable: true,
              capabilities: ["ONE_TIME_PAYMENT", "PIX", "CARD", "STATUS_QUERY", "FULL_REFUND", "WEBHOOK"],
              credentials: {
                API_KEY: { isSet: true, last4: "1234", fingerprint: "sha256:abcd" },
                WEBHOOK_SECRET: { isSet: true, last4: "5678", fingerprint: "sha256:ef01" },
                PUBLIC_KEY: { isSet: false, last4: null, fingerprint: null },
              },
            },
          ],
        }),
      }),
    );

    await page.goto("/backoffice/payment-providers");
    const main = page.locator("#backoffice-main-content");
    await expect(main.getByRole("heading", { name: "Providers de pagamento" })).toBeVisible({ timeout: 60_000 });
    await expect(main.getByText("Abacate Pay · testes")).toBeVisible();
    await expect(main.getByText("Final 1234")).toBeVisible();
    await expect(main.getByText("Abacate Pay · testes")).toBeVisible();
    await expect(main.getByText("e2e-abacate-secret")).toHaveCount(0);
  });

  test("credencial salva não volta para o formulário nem para a resposta", async ({ page }) => {
    const secret = "e2e-abacate-secret";
    const createdInstance = {
      id: "config-new",
      provider: "ABACATE_PAY",
      environment: "DEV",
      displayName: "Abacate Pay · dev",
      logoUrl: null,
      logoAltText: null,
      externalAccountContext: "dev-new",
      enabled: false,
      rolloutState: "DISABLED",
      lastHealthCheckAt: null,
      isDefault: false,
      isSelectable: true,
      capabilities: ["ONE_TIME_PAYMENT", "PIX", "CARD", "STATUS_QUERY", "FULL_REFUND", "WEBHOOK"],
      credentials: { API_KEY: { isSet: true, last4: "cret", fingerprint: "sha256:new" } },
    };
    await page.route("**/api/q/backoffice/payment-providers/instances**", async (route) => {
      if (route.request().method() === "POST") {
        const requestBody = route.request().postDataJSON();
        expect(requestBody.credentials.API_KEY).toBe(secret);
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            isValid: true,
            result: createdInstance,
          }),
        });
        return;
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ isValid: true, result: [createdInstance] }) });
    });

    await page.goto("/backoffice/payment-providers");
    await page.getByRole("button", { name: "Nova instância" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome da instância").fill("Abacate Pay · dev");
    await dialog.getByLabel("Contexto da conta").fill("dev-new");
    await dialog.getByLabel("API key").fill(secret);
    await dialog.getByLabel("Webhook secret").fill("e2e-webhook-secret");
    await dialog.getByLabel("Public key").fill("e2e-public-key");
    await dialog.getByRole("button", { name: "Salvar instância" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("Abacate Pay · dev", { exact: true })).toBeVisible();
    await expect(page.getByText(secret)).toHaveCount(0);
  });

  test("responsivo: sem overflow em viewport mobile", async ({ page }) => {
    await page.route("**/api/q/backoffice/payment-providers/instances**", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ isValid: true, result: [] }) }),
    );
    await page.goto("/backoffice/payment-providers");
    await expect(page.getByRole("heading", { name: "Providers de pagamento" })).toBeVisible({ timeout: 60_000 });
    await runResponsiveChecks(page, { reducedMotion: { ignoreSelector: "svg.animate-spin" } });
  });
});
