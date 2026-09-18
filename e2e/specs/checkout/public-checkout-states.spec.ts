/**
 * SPEC 41 — Checkout, Adesões e Add-ons — Frontend, Estágio E2.
 *
 * Consolida os asserts das telas de confirmação que hoje mentem ou ficam em
 * branco: operator-confirmed (P0-1/P2-7), checkout-return (P1-3/C32) e
 * pix-confirmed (P2-6). Todas as três são páginas públicas que não tocam
 * dinheiro real — o pagamento é sempre mockado via `page.route`, então não
 * há `assertAsaasSandbox()` aqui (nenhum customer/cobrança/checkout é criado
 * no Asaas).
 */

import { expect, test } from "@playwright/test";
import { runResponsiveChecks } from "../../support/responsive";

const OPERATOR_ID = "e2e-operator-pending";

type OperatorMockStatus = "pending" | "confirmed" | "error";

interface OperatorMockState {
  requestCount: number;
  respond: OperatorMockStatus;
}

function buildOperatorPayload(respond: OperatorMockStatus) {
  if (respond === "error") {
    return {
      status: 400,
      body: { isValid: false, successMessages: [], errorMessages: ["Falha simulada de rede"], result: null },
    };
  }

  return {
    status: 200,
    body: {
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: {
        id: OPERATOR_ID,
        name: "Operador E2E",
        email: "operador-e2e@example.com",
        paymentId: "pay_e2e_mock_0000000000",
        paymentStatus: respond === "confirmed" ? "CONFIRMED" : "PENDING",
        operatorCreated: respond === "confirmed",
        managerId: "11111111-1111-1111-1111-111111111111",
      },
    },
  };
}

test.describe("checkout — telas de confirmação param de mentir (SPEC 41 E2)", () => {
  test("operator-confirmed: pagamento pendente faz polling real e mostra 'Verificar novamente' ao atingir o teto (T-41.5)", async ({
    page,
  }) => {
    test.setTimeout(75_000);
    const mock: OperatorMockState = { requestCount: 0, respond: "pending" };

    await page.route("**/api/q/operators/pending/**", async (route) => {
      mock.requestCount += 1;
      const { status, body } = buildOperatorPayload(mock.respond);
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });

    await page.goto(`/operator-confirmed?id=${OPERATOR_ID}`);
    // CardTitle do shadcn renderiza `<div>`, não um heading semântico — o
    // texto é o contrato observável aqui, não o role.
    await expect(page.getByText("Aguardando Confirmação", { exact: true })).toBeVisible();

    const initialCount = mock.requestCount;
    await expect
      .poll(() => mock.requestCount, { timeout: 20_000 })
      .toBeGreaterThan(initialCount);

    // Teto atingido (DA3) — nunca spinner eterno, sempre uma saída visível.
    await expect(page.getByRole("button", { name: "Verificar novamente" })).toBeVisible({ timeout: 60_000 });

    mock.respond = "confirmed";
    const countBeforeRetry = mock.requestCount;
    await page.getByRole("button", { name: "Verificar novamente" }).click();
    await expect.poll(() => mock.requestCount, { timeout: 15_000 }).toBeGreaterThan(countBeforeRetry);
    await expect(page.getByText("Operador Adicionado com Sucesso!", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("operator-confirmed: erro de busca mostra retry real, sem beco sem saída (T-41.8/P2-7)", async ({ page }) => {
    const mock: OperatorMockState = { requestCount: 0, respond: "error" };

    await page.route("**/api/q/operators/pending/**", async (route) => {
      mock.requestCount += 1;
      const { status, body } = buildOperatorPayload(mock.respond);
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });

    await page.goto(`/operator-confirmed?id=${OPERATOR_ID}`);
    await expect(page.getByText("Erro", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ir para o login" })).toBeVisible();

    mock.respond = "confirmed";
    const countBeforeRetry = mock.requestCount;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect.poll(() => mock.requestCount, { timeout: 15_000 }).toBeGreaterThan(countBeforeRetry);
    await expect(page.getByText("Operador Adicionado com Sucesso!", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("pix-confirmed nunca renderiza página em branco (T-41.7/P2-6)", async ({ page }) => {
    await page.goto("/pix-confirmed");
    await expect(page).toHaveURL(/\/checkout-return$/);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
    expect(bodyText).not.toContain("CDP");
  });

  test("checkout-return sem referência: honesto desde o início, nunca 'confirmado' sem verificar (DA1/P1-3)", async ({
    page,
  }) => {
    await page.goto("/checkout-return");
    await expect(
      page.getByRole("heading", { name: "Ainda estamos confirmando o seu pagamento" })
    ).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Pagamento confirmado");
    expect(bodyText).not.toContain("CDP");
    await expect(page.getByRole("button", { name: "Ir para o login" })).toBeVisible();
  });

  test("checkout-return com referência: só confirma depois de consultar o status (DA1)", async ({ page }) => {
    const reference = "pay_e2e_mock_confirmed";

    await page.route(`**/api/q/payments/${reference}/status**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          isValid: true,
          successMessages: [],
          errorMessages: [],
          result: { status: "CONFIRMED" },
        }),
      });
    });

    await page.goto(`/checkout-return?payment=${reference}`);
    await expect(page.getByRole("heading", { name: "Recebemos seu retorno" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pagamento confirmado" })).toBeVisible({ timeout: 10_000 });
  });

  test("checkout-return com referência que nunca confirma: teto com saída honesta, nunca spinner eterno (DA3)", async ({
    page,
  }) => {
    test.setTimeout(75_000);
    const reference = "pay_e2e_mock_never";

    await page.route(`**/api/q/payments/${reference}/status**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          isValid: true,
          successMessages: [],
          errorMessages: [],
          result: { status: "PENDING" },
        }),
      });
    });

    await page.goto(`/checkout-return?payment=${reference}`);
    await expect(page.getByRole("heading", { name: "Recebemos seu retorno" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ainda estamos confirmando o seu pagamento" })
    ).toBeVisible({ timeout: 60_000 });
  });

  test("responsivo: mobile-first sem overflow, touch targets e reduced-motion", async ({ page }) => {
    await page.goto("/checkout-return");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await runResponsiveChecks(page);
  });
});
