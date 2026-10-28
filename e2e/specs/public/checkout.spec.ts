/**
 * Página pública de auto-checkout (`/checkout`).
 *
 * O backend (`public-self-checkout`) é mockado com `page.route`: nenhuma adesão, lead ou cobrança
 * é criada. O destino `/adesao/{token}` também é interceptado, porque o proxy valida o token no
 * banco e um token fictício cairia em `/adesao/expirado`.
 */

import { expect, test, type Page, type Route } from "@playwright/test";
import { runResponsiveChecks } from "../../support/responsive";

const TOKEN = "e2e-self-checkout-token";

const OPTIONS = {
  product: { name: "Corretor Studio", description: "Gestão de leads para corretores." },
  cycles: [
    { cycle: "monthly", label: "Mensal", pixTotal: 100, monthlyEquivalent: 100, months: 1 },
    { cycle: "quarterly", label: "Trimestral", pixTotal: 270, monthlyEquivalent: 90, months: 3 },
    { cycle: "annual", label: "Anual", pixTotal: 960, monthlyEquivalent: 80, months: 12 },
  ],
};

function envelope(result: unknown) {
  return JSON.stringify({ isValid: true, successMessages: [], errorMessages: [], result });
}

function errorEnvelope(message: string) {
  return JSON.stringify({ isValid: false, successMessages: [], errorMessages: [message] });
}

type CreateHandler = (route: Route) => Promise<void>;

interface SelfCheckoutMocks {
  createBodies: Record<string, unknown>[];
  optionsCalls: () => number;
}

async function mockSelfCheckoutApi(
  page: Page,
  options: { optionsStatus?: number; optionsBody?: string; create?: CreateHandler } = {},
): Promise<SelfCheckoutMocks> {
  const createBodies: Record<string, unknown>[] = [];
  let optionsCalls = 0;

  await page.route("**/api/**/public-self-checkout/options", async (route) => {
    optionsCalls += 1;
    await route.fulfill({
      status: options.optionsStatus ?? 200,
      contentType: "application/json",
      body: options.optionsBody ?? envelope(OPTIONS),
    });
  });

  await page.route("**/api/**/public-self-checkout", async (route) => {
    createBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (options.create) {
      await options.create(route);
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope({ token: TOKEN }),
    });
  });

  await page.route(`**/adesao/${TOKEN}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body><h1>Pagamento da adesão</h1></body></html>",
    });
  });

  return { createBodies, optionsCalls: () => optionsCalls };
}

async function fillBuyer(page: Page) {
  await page.getByLabel("Nome completo").fill("Maria Souza");
  await page.getByLabel("E-mail").fill("Maria@Example.com");
  await page.getByLabel("Celular").fill("11999998888");
}

const continueButton = (page: Page) =>
  page.getByRole("button", { name: /Continuar para o pagamento/ });

test.describe("app/checkout", () => {
  test("renderiza os ciclos devolvidos pela API com preço PIX e equivalente mensal", async ({ page }) => {
    await mockSelfCheckoutApi(page);
    await page.goto("/checkout");

    await expect(page.getByRole("heading", { name: "Escolha seu plano" })).toBeVisible();
    await expect(page.getByText("Gestão de leads para corretores.")).toBeVisible();

    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(3);
    await expect(page.getByRole("radio", { name: "Mensal" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Trimestral" })).toHaveAccessibleDescription(
      /R\$\s270,00.*à vista no PIX.*R\$\s90,00 por mês/,
    );
    await expect(page.getByRole("radio", { name: "Anual" })).toHaveAccessibleDescription(/R\$\s960,00/);
  });

  test("não expõe o honeypot a leitores de tela nem ao teclado", async ({ page }) => {
    await mockSelfCheckoutApi(page);
    await page.goto("/checkout");
    await expect(page.getByRole("radio")).toHaveCount(3);

    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveAttribute("tabindex", "-1");
    await expect(honeypot).toHaveAttribute("autocomplete", "off");
    await expect(page.getByRole("textbox", { name: /Não preencha/ })).toHaveCount(0);
    const insideHidden = await honeypot.evaluate((element) => !!element.closest('[aria-hidden="true"]'));
    expect(insideHidden).toBe(true);
    const box = await honeypot.boundingBox();
    expect(box === null || box.x + box.width < 0).toBe(true);
  });

  test("seleciona outro ciclo, envia só o ciclo e os dados do comprador e abre /adesao/{token}", async ({
    page,
  }) => {
    const mocks = await mockSelfCheckoutApi(page);
    await page.goto("/checkout");

    await page.getByRole("radio", { name: "Anual" }).click();
    await expect(page.getByRole("radio", { name: "Anual" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Mensal" })).not.toBeChecked();

    await fillBuyer(page);
    await expect(page.getByLabel("Celular")).toHaveValue("(11) 99999-8888");
    await continueButton(page).click();

    await expect(page).toHaveURL(new RegExp(`/adesao/${TOKEN}$`));
    expect(mocks.createBodies).toEqual([
      {
        fullName: "Maria Souza",
        email: "maria@example.com",
        phone: "11999998888",
        cycle: "annual",
        website: "",
      },
    ]);
    const keys = Object.keys(mocks.createBodies[0]);
    expect(keys.some((key) => /price|amount|total|pix/i.test(key))).toBe(false);
  });

  test("duplo clique gera um único POST e mantém o botão travado", async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mocks = await mockSelfCheckoutApi(page, {
      create: async (route) => {
        await gate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: envelope({ token: TOKEN }),
        });
      },
    });
    await page.goto("/checkout");
    await fillBuyer(page);

    await continueButton(page).dblclick();
    await expect(page.getByRole("button", { name: /Criando seu pedido/ })).toBeDisabled();
    expect(mocks.createBodies).toHaveLength(1);

    release();
    await expect(page).toHaveURL(new RegExp(`/adesao/${TOKEN}$`));
    expect(mocks.createBodies).toHaveLength(1);
  });

  test("valida os campos inline sem chamar a API", async ({ page }) => {
    const mocks = await mockSelfCheckoutApi(page);
    await page.goto("/checkout");

    await page.getByLabel("E-mail").fill("nao-e-email");
    await continueButton(page).click();

    await expect(page.getByText("Informe seu nome completo.")).toBeVisible();
    await expect(page.getByText("E-mail inválido.")).toBeVisible();
    await expect(page.getByText("Celular inválido.")).toBeVisible();
    await expect(page.getByLabel("Nome completo")).toBeFocused();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createBodies).toHaveLength(0);
  });

  test("409 mostra conta existente com link para entrar e libera o botão", async ({ page }) => {
    await mockSelfCheckoutApi(page, {
      create: (route) =>
        route.fulfill({
          status: 409,
          contentType: "application/json",
          body: errorEnvelope("Conta já cadastrada."),
        }),
    });
    await page.goto("/checkout");
    await fillBuyer(page);
    await continueButton(page).click();

    await expect(page.getByText("Já existe uma conta com este e-mail.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar na sua conta" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    await expect(continueButton(page)).toBeEnabled();
  });

  for (const [status, message] of [
    [429, "Muitas tentativas. Aguarde alguns minutos e tente novamente."],
    [503, "Pagamento temporariamente indisponível. Tente novamente em instantes."],
    [500, "Não foi possível continuar. Tente novamente."],
  ] as const) {
    test(`status ${status} mostra a mensagem do produto`, async ({ page }) => {
      await mockSelfCheckoutApi(page, {
        create: (route) =>
          route.fulfill({
            status,
            contentType: "application/json",
            body: status === 500 ? "<html>erro</html>" : errorEnvelope("interno"),
          }),
      });
      await page.goto("/checkout");
      await fillBuyer(page);
      await continueButton(page).click();

      await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
      await expect(continueButton(page)).toBeEnabled();
    });
  }

  test("lista vazia mostra compra online indisponível com link para o início", async ({ page }) => {
    await mockSelfCheckoutApi(page, {
      optionsBody: envelope({ ...OPTIONS, cycles: [] }),
    });
    await page.goto("/checkout");

    await expect(page.getByText("Compra online indisponível no momento")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(continueButton(page)).toHaveCount(0);
  });

  test("erro de carga oferece tentar de novo e recupera", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/**/public-self-checkout/options", async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: errorEnvelope("Não foi possível carregar os planos."),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: envelope(OPTIONS) });
    });
    await page.goto("/checkout");

    await expect(page.getByText("Não foi possível carregar os planos.")).toBeVisible();
    await page.getByRole("button", { name: "Tentar de novo" }).click();

    await expect(page.getByRole("radio")).toHaveCount(3);
  });

  test("responsivo: sem overflow, alvos de 44px e reduced motion", async ({ page }) => {
    await mockSelfCheckoutApi(page);
    await page.goto("/checkout");
    await expect(page.getByRole("radio")).toHaveCount(3);

    await runResponsiveChecks(page);
  });
});
