/**
 * Checkout interno de PIX para compra genérica (PlatformPurchase, ex.: créditos de e-mail).
 *
 * Todo o backend é mockado com `page.route`: nenhum pagamento, cliente ou cobrança
 * é criado em provider algum.
 */

import { expect, test, type Page } from "@playwright/test"
import { runResponsiveChecks } from "../../support/responsive"

const PURCHASE_ID = "e2e-platform-purchase"
const PIX_CODE = "00020126E2EPIXCOPIAECOLA"
const FAR_FUTURE = "2999-01-01T12:00:00.000Z"

type PurchaseStatus = "pending" | "paid"

function envelope(result: unknown) {
  return JSON.stringify({ isValid: true, successMessages: [], errorMessages: [], result })
}

function purchasePayload(status: PurchaseStatus) {
  return {
    checkoutId: PURCHASE_ID,
    purchaseId: PURCHASE_ID,
    productSlug: "email-credits-plus",
    purchaseType: "email_credits",
    status,
    billingType: "PIX",
    amount: 100,
    quantity: 5000,
    description: "Créditos de e-mail — plano plus",
    teamId: null,
    metadata: { plan: "plus" },
  }
}

const PAST = "2000-01-01T12:00:00.000Z"

async function mockPlatformCheckout(page: Page, pixExpirations: string[] = [FAR_FUTURE]) {
  const state = {
    status: "pending" as PurchaseStatus,
    paymentRequests: [] as { idempotencyKey: string | undefined; body: unknown }[],
  }

  await page.route(`**/api/**/platform-checkout/${PURCHASE_ID}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: envelope(purchasePayload(state.status)) })
  })

  await page.route(`**/api/**/payment-provider-payment/${PURCHASE_ID}`, async (route) => {
    const request = route.request()
    state.paymentRequests.push({
      idempotencyKey: request.headers()["idempotency-key"],
      body: request.postDataJSON(),
    })
    const expiresAt = pixExpirations[Math.min(state.paymentRequests.length - 1, pixExpirations.length - 1)]
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope({
        amountInCents: 10000,
        pix: { brCode: PIX_CODE, brCodeBase64: "iVBORw0KGgo=", expiresAt },
      }),
    })
  })

  return state
}

async function fillPayer(page: Page) {
  const fields = page.getByRole("textbox")
  await fields.nth(0).fill("Maria Souza")
  await fields.nth(1).fill("maria@example.com")
  await fields.nth(2).fill("11999998888")
  await fields.nth(3).fill("52998224725")
}

test.describe("addon-checkout — PIX interno para compra genérica", () => {
  test("gera o PIX sem pedir endereço nem oferecer cartão e confirma sem prometer crédito instantâneo", async ({
    page,
  }) => {
    const mock = await mockPlatformCheckout(page)

    await page.goto(`/addon-checkout/${PURCHASE_ID}`)
    await page.getByRole("button", { name: /Finalizar Pagamento/ }).click()

    await expect(page.getByText("Cartão de crédito")).toHaveCount(0)
    await expect(page.getByText("CEP")).toHaveCount(0)

    const submit = page.getByRole("button", { name: "Gerar QR Code Pix" })
    await expect(submit).toBeDisabled()
    await fillPayer(page)
    await expect(submit).toBeEnabled()
    await submit.click()

    await expect(page.getByText(PIX_CODE)).toBeVisible()
    await expect(page.getByAltText("QR Code PIX")).toBeVisible()
    await expect(page.getByRole("button", { name: "Copiar código PIX" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Gerar novo PIX" })).toHaveCount(0)

    // Rodapé identifica o Abacate e não usa a marca do Asaas.
    await expect(page.getByText("Pagamento processado pela AbacatePay")).toBeVisible()
    await expect(page.getByAltText("Asaas Pagamentos")).toHaveCount(0)

    expect(mock.paymentRequests).toHaveLength(1)
    expect(mock.paymentRequests[0].idempotencyKey).toContain(`platform-pix:${PURCHASE_ID}:`)
    expect(mock.paymentRequests[0].body).toEqual({
      method: "PIX",
      customer: {
        name: "Maria Souza",
        email: "maria@example.com",
        taxId: "52998224725",
        cellphone: "11999998888",
      },
    })

    // A confirmação chega pelo auto-refresh do fluxo (GET /platform-checkout, a cada 8s).
    mock.status = "paid"

    await expect(page.getByText("Pagamento confirmado")).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText("Os créditos são aplicados automaticamente em até 5 minutos.")).toBeVisible()
    await expect(page.getByText(/imediatamente|instantane/i)).toHaveCount(0)

    await runResponsiveChecks(page)
  })

  test("não mostra valor vazio no resumo quando a compra não tem time", async ({ page }) => {
    await mockPlatformCheckout(page)

    await page.goto(`/addon-checkout/${PURCHASE_ID}`)

    await expect(page.getByText("5.000 créditos/mês").first()).toBeVisible()
    await expect(page.getByText("—", { exact: true })).toHaveCount(0)
    await expect(page.getByText("5.000 créditos/mês ·")).toHaveCount(0)
  })

  test("oferece gerar novo PIX quando o PIX expira e usa uma chave de idempotência nova", async ({ page }) => {
    const mock = await mockPlatformCheckout(page, [PAST, FAR_FUTURE])

    await page.goto(`/addon-checkout/${PURCHASE_ID}`)
    await page.getByRole("button", { name: /Finalizar Pagamento/ }).click()
    await fillPayer(page)
    await page.getByRole("button", { name: "Gerar QR Code Pix" }).click()

    await expect(page.getByText("Este PIX expirou. Gere um novo PIX para pagar.")).toBeVisible()
    await page.getByRole("button", { name: "Gerar novo PIX" }).click()

    await expect(page.getByText("Este PIX expirou. Gere um novo PIX para pagar.")).toHaveCount(0)
    expect(mock.paymentRequests).toHaveLength(2)
    expect(mock.paymentRequests[1].idempotencyKey).not.toBe(mock.paymentRequests[0].idempotencyKey)
    expect(mock.paymentRequests[1].body).toEqual(mock.paymentRequests[0].body)

    await runResponsiveChecks(page)
  })

  test("mantém o layout sem overflow em 360px com o PIX exibido", async ({ page }) => {
    await mockPlatformCheckout(page)

    await page.goto(`/addon-checkout/${PURCHASE_ID}`)
    await page.getByRole("button", { name: /Finalizar Pagamento/ }).click()
    await fillPayer(page)
    await page.getByRole("button", { name: "Gerar QR Code Pix" }).click()
    await expect(page.getByText(PIX_CODE)).toBeVisible()

    await runResponsiveChecks(page)
  })
})

const PENDING_ACTION_ID = "e2e-pending-action"

async function mockPendingActionCheckout(page: Page, availableBillingTypes?: string[]) {
  // Sem compra de plataforma: força o caminho legado (pending action, Asaas).
  await page.route(`**/api/**/platform-checkout/${PENDING_ACTION_ID}`, async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ isValid: false }) })
  })
  await page.route(`**/api/**/addon-checkout/${PENDING_ACTION_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope({
        pendingActionId: PENDING_ACTION_ID,
        paymentId: null,
        // Time que já veio com cartão pré-selecionado: não pode aparecer com o cartão desligado.
        presetBillingType: "CREDIT_CARD",
        addonType: "team",
        addonLabel: "Time adicional",
        addonDetail: "Time Comercial",
        pricing: { monthlyPrice: 50, remainingMonths: 3, totalCharge: 150, maxInstallments: 3 },
        status: "pending",
        masterName: "Master",
        defaultBillingData: {
          fullName: "",
          email: "",
          phone: "",
          cpfCnpj: "",
          postalCode: "",
          address: "",
          addressNumber: "",
          neighborhood: "",
          complement: "",
          city: "",
          state: "",
        },
        ...(availableBillingTypes ? { availableBillingTypes } : {}),
      }),
    })
  })
}

test.describe("addon-checkout — cartão desligado em checkouts Asaas", () => {
  for (const [label, types] of [
    ["só PIX declarado", ["PIX"]],
    ["campo ausente (falha fechada)", undefined],
  ] as const) {
    test(`não oferece nem pré-seleciona cartão com ${label}`, async ({ page }) => {
      await mockPendingActionCheckout(page, types ? [...types] : undefined)

      await page.goto(`/addon-checkout/${PENDING_ACTION_ID}`)
      await page.getByRole("button", { name: /Finalizar Pagamento/ }).click()

      await expect(page.getByRole("button", { name: "Gerar QR Code Pix" })).toBeVisible()
      await expect(page.getByText("Cartão de crédito")).toHaveCount(0)
      await expect(page.getByText("Pagar com cartão")).toHaveCount(0)
      await expect(page.getByText("Número do cartão")).toHaveCount(0)

      await runResponsiveChecks(page)
    })
  }

  test("oferece cartão apenas quando o servidor declara CREDIT_CARD disponível", async ({ page }) => {
    await mockPendingActionCheckout(page, ["PIX", "CREDIT_CARD"])

    await page.goto(`/addon-checkout/${PENDING_ACTION_ID}`)
    await page.getByRole("button", { name: /Finalizar Pagamento/ }).click()

    await expect(page.getByText("Cartão de crédito").first()).toBeVisible()
  })
})
