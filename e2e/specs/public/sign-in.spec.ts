/**
 * Regressão: botão "Entrar" voltava ao estado normal entre o fim do server
 * action e o fim da navegação para o CRM, levando o usuário a clicar várias
 * vezes sem entrar logado. O login real (Supabase) não roda no E2E, então o
 * server action é mockado devolvendo o mesmo contrato do `redirect()` do
 * Next (`x-action-redirect`) e a navegação de destino é segurada.
 */

import { expect, test, type Page, type Route } from "@playwright/test";
import { runResponsiveChecks } from "../../support/responsive";

const REDIRECT_TARGET = "/e2e-sign-in-redirect/crm";

interface SignInMocks {
  actionCalls: () => number;
  releaseDestination: () => void;
}

async function mockSignInServerAction(
  page: Page,
  respond: (route: Route) => Promise<void>,
): Promise<SignInMocks> {
  let calls = 0;
  let release: () => void = () => undefined;
  const destinationGate = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route("**/sign-in*", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      calls += 1;
      await respond(route);
      return;
    }
    await route.continue();
  });

  // Destino do redirect: o proxy/bootstrap do layout é lento em produção.
  await page.route(`**${REDIRECT_TARGET}*`, async (route) => {
    await destinationGate;
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body><h1>CRM</h1></body></html>",
    });
  });

  return { actionCalls: () => calls, releaseDestination: release };
}

async function fillCredentials(page: Page): Promise<void> {
  await page.getByLabel("E-mail").fill("corretor@example.com");
  await page.locator('input[type="password"]').fill("senha-valida-123");
}

test.describe("app/(auth)/sign-in", () => {
  test("carrega a tela de login com o botão Entrar", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(
      page.getByRole("heading", { name: /Bem-vindo ao Corretor Studio/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("login válido mantém o botão bloqueado até a navegação terminar", async ({ page }) => {
    const mocks = await mockSignInServerAction(page, (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "content-type": "text/x-component",
          "x-action-redirect": `${REDIRECT_TARGET};push`,
        },
        body: '0:{"a":"$@1","f":"","b":"e2e"}\n1:null\n',
      }),
    );

    await page.goto("/sign-in");
    await fillCredentials(page);

    const submit = page.getByRole("button", { name: /Entrar|Entrando/ });
    await expect(submit).toBeEnabled();
    await submit.click();

    // O server action já respondeu; a navegação de destino ainda está presa.
    await expect.poll(mocks.actionCalls).toBe(1);
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveText("Entrando...");

    // Cliques repetidos não podem disparar novos logins.
    await submit.click({ force: true }).catch(() => undefined);
    await page.keyboard.press("Enter");
    expect(mocks.actionCalls()).toBe(1);
    await expect(submit).toBeDisabled();

    mocks.releaseDestination();
    await expect(page).toHaveURL(new RegExp(`${REDIRECT_TARGET}$`));
  });

  test("credencial inválida reabilita o botão e mostra o erro", async ({ page }) => {
    const mocks = await mockSignInServerAction(page, (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/x-component" },
        body:
          '0:{"a":"$@1","f":"","b":"e2e"}\n' +
          '1:{"success":false,"errors":{"apiError":"Email ou senha inválidos"}}\n',
      }),
    );

    await page.goto("/sign-in");
    await fillCredentials(page);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect.poll(mocks.actionCalls).toBe(1);
    await expect(page.getByText("Email ou senha inválidos").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await runResponsiveChecks(page);
  });
});
