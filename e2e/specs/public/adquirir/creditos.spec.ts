import { expect, test } from "@playwright/test";
import { injectE2eAuthCookie } from "../../../fixtures/auth";
import { runResponsiveChecks } from "../../../support/responsive";

// A contratação exige sessão: a página redireciona anônimos ao login e, logado,
// a compra nasce no servidor (PlatformPurchase) e segue ao checkout interno.
// O backend é mockado com `page.route`: nenhuma compra ou cobrança é criada.

const PURCHASE_CHECKOUT_PATH = "/addon-checkout/e2e-platform-purchase";

test.describe("public/adquirir/creditos", () => {
  test("anônimo é levado ao login com retorno para a página", async ({ page }) => {
    await page.goto("/adquirir/creditos");

    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadquirir%2Fcreditos/);
  });

  test.describe("com sessão", () => {
    test.beforeEach(async ({ context }) => {
      await injectE2eAuthCookie(context);
    });

    test("carrega sem erro e mostra heading e cards", async ({ page }) => {
      await page.goto("/adquirir/creditos");
      await expect(page.getByRole("heading", { name: /Ative seu volume mensal de disparo/i })).toBeVisible();
      await expect(page.getByText("25 mil")).toBeVisible();
      await expect(page.getByText("375").first()).toBeVisible();
      await expect(page.getByText("50 mil")).toBeVisible();
      await expect(page.getByText("650").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Ativar" })).toHaveCount(2);
    });

    test("não pede e-mail e envia só o plano ao iniciar a compra", async ({ page }) => {
      let requestBody: unknown = null;
      await page.route("**/api/**/adquirir/creditos/validar", async (route) => {
        requestBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: true,
            successMessages: [],
            errorMessages: [],
            result: { checkoutUrl: PURCHASE_CHECKOUT_PATH, plan: "25k" },
          }),
        });
      });
      await page.route(`**${PURCHASE_CHECKOUT_PATH}`, async (route) => {
        await route.fulfill({ status: 200, contentType: "text/html", body: "<title>checkout</title>" });
      });

      await page.goto("/adquirir/creditos");
      await expect(page.getByLabel(/E-mail/i)).toHaveCount(0);
      await page.getByRole("button", { name: "Ativar" }).first().click();

      await expect(page).toHaveURL(new RegExp(`${PURCHASE_CHECKOUT_PATH}$`));
      expect(requestBody).toEqual({ plan: "25k" });
    });

    test("mostra o erro do servidor e mantém a página", async ({ page }) => {
      await page.route("**/api/**/adquirir/creditos/validar", async (route) => {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            isValid: false,
            successMessages: [],
            errorMessages: ["Apenas managers podem contratar créditos de e-mail"],
            result: null,
          }),
        });
      });

      await page.goto("/adquirir/creditos");
      await page.getByRole("button", { name: "Ativar" }).first().click();

      await expect(page.getByText(/Apenas managers/i)).toBeVisible();
      await expect(page).toHaveURL(/\/adquirir\/creditos$/);
    });

    test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({ page }) => {
      await page.goto("/adquirir/creditos");
      await expect(page.getByRole("heading", { name: /Ative seu volume mensal de disparo/i })).toBeVisible();
      await runResponsiveChecks(page);
    });
  });
});
