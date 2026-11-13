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
    let instanceCreated = false;
    await page.route("**/api/q/backoffice/payment-providers/instances**", async (route) => {
      if (route.request().method() === "POST") {
        const requestBody = route.request().postDataJSON();
        expect(requestBody.credentials.API_KEY).toBe(secret);
        expect(requestBody.credentials.WEBHOOK_SECRET).toBe("e2e-webhook-secret");
        expect(requestBody.credentials.PUBLIC_KEY).toBe("e2e-public-key");
        instanceCreated = true;
        const responseBody = JSON.stringify({ isValid: true, result: createdInstance });
        expect(responseBody).not.toContain(secret);
        await route.fulfill({ contentType: "application/json", body: responseBody });
        return;
      }
      const result = instanceCreated ? [createdInstance] : [];
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ isValid: true, result }) });
    });

    await page.goto("/backoffice/payment-providers");
    const apiKey = page.locator("#ABACATE_PAY-DEV-API_KEY");
    await page.getByRole("button", { name: /Configurar desenvolvimento/ }).first().click();
    await page.locator("#ABACATE_PAY-DEV-context").fill("dev-new");
    await apiKey.fill(secret);
    await page.locator("#ABACATE_PAY-DEV-WEBHOOK_SECRET").fill("e2e-webhook-secret");
    await page.locator("#ABACATE_PAY-DEV-PUBLIC_KEY").fill("e2e-public-key");
    await page.getByRole("button", { name: "Salvar desenvolvimento" }).click();

    await expect(page.getByText("Abacate Pay · dev", { exact: true })).toBeVisible();
    await expect(apiKey).toHaveValue("");
    await expect(page.getByText(secret)).toHaveCount(0);
  });

  test("cartão: ligar pede confirmação e usa a revisão atual; desligar é direto", async ({ page }) => {
    const abacate = (environment: string, cardEnabled: boolean, revision: number, isDefault = true) => ({
      provider: "ABACATE_PAY",
      environment,
      enabled: true,
      isDefault,
      externalAccountContext: isDefault ? "e2e-default" : "e2e-non-default",
      rolloutState: "ACTIVE",
      killSwitch: false,
      cardEnabled,
      revision,
      healthStatus: "UNKNOWN",
    });
    const puts: Array<{ environment: string; patch: { cardEnabled: boolean; expectedRevision: number } }> = [];
    await page.route("**/api/q/backoffice/payment-providers/config**", async (route) => {
      const request = route.request();
      if (request.method() === "PUT") {
        const body = request.postDataJSON();
        puts.push(body);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: true,
            result: abacate(body.environment, body.patch.cardEnabled, body.patch.expectedRevision + 1),
          }),
        });
        return;
      }
      const environment = new URL(request.url()).searchParams.get("environment") ?? "DEV";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          isValid: true,
          result: [abacate(environment, true, 2, false), abacate(environment, false, 4)],
        }),
      });
    });
    await page.route("**/api/q/backoffice/payment-providers/instances**", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ isValid: true, result: [] }) }),
    );

    await page.goto("/backoffice/payment-providers");
    const card = page.getByTestId("card-config");
    await expect(card.getByText("Cartão de crédito", { exact: true })).toBeVisible({ timeout: 60_000 });
    const productionSwitch = card.getByRole("switch", { name: "Cartão de crédito em Produção" });
    await expect(productionSwitch).not.toBeChecked();

    await productionSwitch.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Ligar o cartão de crédito?")).toBeVisible();
    expect(puts).toHaveLength(0);
    await dialog.getByRole("button", { name: "Ligar cartão" }).click();
    await expect(productionSwitch).toBeChecked();
    expect(puts[0]).toEqual({
      environment: "PRODUCTION",
      provider: "ABACATE_PAY",
      patch: { cardEnabled: true, expectedRevision: 4 },
    });

    await productionSwitch.click();
    await expect(productionSwitch).not.toBeChecked();
    expect(puts[1]?.patch).toEqual({ cardEnabled: false, expectedRevision: 5 });
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
