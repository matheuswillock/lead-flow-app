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

const ADHESION_DETAILS = {
  id: "adhesion-e2e",
  fullName: "Maria Souza",
  phone: "11999998888",
  cpfCnpj: "11222333000181",
  email: "maria@example.com",
  billingType: "PIX",
  status: "pending",
  cycle: "annual",
  cycleLabel: "Anual",
  cycleMonths: 12,
  modules: [],
  extraTeams: 0,
  extraUsers: 0,
  monthlyBaseAmount: 80,
  monthlyExtraTeamsAmount: 0,
  monthlyExtraUsersAmount: 0,
  monthlyTotalAmount: 80,
  totalAmount: 960,
  maxInstallments: 12,
  pixMonthlyTotalAmount: 80,
  pixTotalAmount: 960,
  creditCardMonthlyTotalAmount: 80,
  creditCardTotalAmount: 960,
  maxCardInstallments: 12,
  installmentSplitMode: "EQUAL",
  installmentSchedule: [],
  remainingBalance: 0,
  chargeAmount: 0,
  availableBillingTypes: ["PIX"],
  pixProvider: "ABACATE_PAY",
  extrasTotalAmount: 0,
  isSelfCheckout: true,
  companyName: "Corretora Exemplo Ltda",
  createdAt: "2026-11-06T12:00:00.000Z",
  paidAt: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
};

const PIX_PAYMENT = {
  adhesionId: "adhesion-e2e",
  paymentId: "pix-e2e",
  status: "pending",
  billingType: "PIX",
  amount: 960,
  invoiceUrl: null,
  bankSlipUrl: null,
  pix: { encodedImage: "", payload: "00020126e2e-pix-payload", expirationDate: "2099-01-01T00:00:00.000Z" },
};

interface SelfCheckoutMocks {
  createBodies: Record<string, unknown>[];
  pixBodies: Record<string, unknown>[];
  optionsCalls: () => number;
}

async function mockSelfCheckoutApi(
  page: Page,
  options: { optionsStatus?: number; optionsBody?: string; create?: CreateHandler } = {},
): Promise<SelfCheckoutMocks> {
  const createBodies: Record<string, unknown>[] = [];
  const pixBodies: Record<string, unknown>[] = [];
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

  // A consulta pública de CNPJ nunca sai do teste: sem resposta, o cliente preenche à mão.
  await page.route("**/brasilapi.com.br/**", async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });

  // Depois do pedido criado, a mesma tela gera o PIX pela adesão: nada disso toca o banco.
  await page.route(`**/api/**/public-adhesions/${TOKEN}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: envelope(ADHESION_DETAILS) });
  });
  await page.route(`**/api/**/public-adhesions/${TOKEN}/pix`, async (route) => {
    pixBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: "application/json", body: envelope(PIX_PAYMENT) });
  });
  await page.route(`**/api/**/public-adhesions/${TOKEN}/payment-status**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: envelope(PIX_PAYMENT) });
  });

  return { createBodies, pixBodies, optionsCalls: () => optionsCalls };
}

/** Os dados da empresa só aparecem na fase "Seus dados": Continuar a partir do período. */
async function goToBuyerData(page: Page) {
  if ((await page.getByLabel("Razão social").count()) === 0) {
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
  }
}

async function fillBuyer(page: Page) {
  await goToBuyerData(page);
  await page.getByLabel("Razão social").fill("Corretora Exemplo Ltda");
  await page.getByLabel("CNPJ").fill("11222333000181");
  await page.getByLabel("Nome completo").fill("Maria Souza");
  await page.getByLabel("E-mail").fill("Maria@Example.com");
  await page.getByLabel("WhatsApp").fill("11999998888");
  await page.getByRole("checkbox", { name: /Declaro que li e concordo/ }).check();
}

const payButton = (page: Page) => page.getByRole("button", { name: /Gerar QR Code PIX|Criando seu pedido/ });

test.describe("app/checkout", () => {
  test("renderiza os ciclos devolvidos pela API com preço PIX e equivalente mensal", async ({ page }) => {
    await mockSelfCheckoutApi(page);
    await page.goto("/checkout");

    await expect(page.getByRole("heading", { name: "Contrate o Corretor Studio" })).toBeVisible();

    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(3);
    await expect(page.getByRole("radio", { name: "Anual" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Trimestral" })).toHaveAccessibleDescription(
      /R\$\s270,00.*à vista no PIX.*R\$\s90,00 por mês/,
    );
    await expect(page.getByRole("radio", { name: "Anual" })).toHaveAccessibleDescription(/R\$\s960,00/);
  });

  test("mantém a estrutura do checkout acessível enquanto carrega os planos", async ({ page }) => {
    let resolveOptions!: () => void;
    const optionsReady = new Promise<void>((resolve) => {
      resolveOptions = resolve;
    });
    await page.route("**/api/**/public-self-checkout/options", async (route) => {
      await optionsReady;
      await route.fulfill({ status: 200, contentType: "application/json", body: envelope(OPTIONS) });
    });

    await page.goto("/checkout");
    await expect(page.getByRole("status", { name: "Carregando planos" })).toBeVisible();
    resolveOptions();
    await expect(page.getByRole("heading", { name: "Contrate o Corretor Studio" })).toBeVisible();
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

  test("fases na mesma página: dados só depois de Continuar, e Voltar mantém o período", async ({ page }) => {
    await mockSelfCheckoutApi(page);
    await page.goto("/checkout");

    await expect(page.getByRole("radio", { name: "Anual" })).toBeChecked();
    await expect(page.getByLabel("Razão social")).toHaveCount(0);
    await expect(payButton(page)).toBeVisible();

    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.getByLabel("Razão social")).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);

    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Anual" })).toBeChecked();
    await expect(page.getByLabel("Razão social")).toHaveCount(0);
  });

  test("PIX tem duas fases no stepper e o celular mostra a fase atual em texto", async ({ page }) => {
    await mockSelfCheckoutApi(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/checkout");

    await expect(page.getByText("Passo 1 de 2: Período do plano")).toBeVisible();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.getByText("Passo 2 de 2: Seus dados")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar QR Code PIX" })).toBeVisible();
  });

  test("seleciona outro ciclo, cria o pedido só ao enviar os dados e gera o PIX na mesma tela", async ({
    page,
  }) => {
    const mocks = await mockSelfCheckoutApi(page);
    await page.goto("/checkout");

    await page.getByRole("radio", { name: "Anual" }).click();
    await expect(page.getByRole("radio", { name: "Anual" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Mensal" })).not.toBeChecked();

    await fillBuyer(page);
    await expect(page.getByLabel("WhatsApp")).toHaveValue("(11) 99999-8888");
    expect(mocks.createBodies).toHaveLength(0);
    await payButton(page).click();

    await expect(page.getByRole("button", { name: "Copiar", exact: true })).toBeVisible();
    expect(mocks.pixBodies).toHaveLength(1);
    expect(mocks.createBodies).toEqual([
      {
        companyLegalName: "Corretora Exemplo Ltda",
        cnpj: "11222333000181",
        fullName: "Maria Souza",
        email: "maria@example.com",
        phone: "11999998888",
        cycle: "annual",
        termsAccepted: true,
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

    await payButton(page).dblclick();
    await expect(page.getByRole("button", { name: /Criando seu pedido/ })).toBeDisabled();
    expect(mocks.createBodies).toHaveLength(1);

    release();
    await expect(page.getByRole("button", { name: "Copiar", exact: true })).toBeVisible();
    expect(mocks.createBodies).toHaveLength(1);
    expect(mocks.pixBodies).toHaveLength(1);
  });

  test("valida os campos inline sem chamar a API", async ({ page }) => {
    const mocks = await mockSelfCheckoutApi(page);
    await page.goto("/checkout");
    await goToBuyerData(page);

    await page.getByLabel("E-mail").fill("nao-e-email");
    await payButton(page).click();

    await expect(page.getByText("Informe a razão social conforme o CNPJ.")).toBeVisible();
    await expect(page.getByText("Informe seu nome completo.")).toBeVisible();
    await expect(page.getByText("E-mail inválido.")).toBeVisible();
    await expect(page.getByText("WhatsApp inválido.")).toBeVisible();
    // O CNPJ é o primeiro campo da tela, então recebe o foco.
    await expect(page.getByLabel("CNPJ")).toBeFocused();
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
    await payButton(page).click();

    await expect(page.getByText("Já existe uma conta com este e-mail.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar na sua conta" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    await expect(payButton(page)).toBeEnabled();
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
      await payButton(page).click();

      await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
      await expect(payButton(page)).toBeEnabled();
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
    await expect(payButton(page)).toHaveCount(0);
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

    await expect(page.getByRole("main").getByText("Não foi possível carregar os planos.")).toBeVisible();
    await page.getByRole("button", { name: "Tentar de novo" }).click();

    await expect(page.getByRole("radio")).toHaveCount(3);
  });

  test("textos longos sem espaços não causam overflow em viewport mobile", async ({ page }) => {
    const longText = "Plano".repeat(80);
    await mockSelfCheckoutApi(page, {
      optionsBody: envelope({
        product: { name: longText, description: longText },
        cycles: OPTIONS.cycles.map((cycle) => ({ ...cycle, label: longText })),
      }),
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/checkout");

    await expect(page.getByRole("radio")).toHaveCount(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("responsivo: sem overflow, alvos de 44px e reduced motion", async ({ page }) => {
    await mockSelfCheckoutApi(page);
    await page.goto("/checkout");
    await expect(page.getByRole("radio")).toHaveCount(3);

    await runResponsiveChecks(page, { widths: [320, 360, 375, 768, 1024, 1280] });
  });
});
