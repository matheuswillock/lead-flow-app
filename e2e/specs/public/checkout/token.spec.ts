import { expect, test, type Page } from "@playwright/test"
import { runResponsiveChecks } from "../../../support/responsive"

function envelope(result: unknown) {
  return JSON.stringify({ isValid: true, successMessages: [], errorMessages: [], result })
}

async function mockIntent(page: Page, availableBillingTypes?: string[]) {
  await page.route("**/api/**/billing/checkout-intents/test-token", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: envelope({
        productSlug: "crm-monthly",
        cycle: "MONTHLY",
        prices: { PIX: 100, CREDIT_CARD: 110 },
        expiresAt: "2999-01-01T12:00:00.000Z",
        ...(availableBillingTypes ? { availableBillingTypes } : {}),
      }),
    })
  })
}

test.describe("checkout público por intenção", () => {
  test("renderiza a etapa de escolha de método", async ({ page }) => {
    await page.goto("/checkout/test-token")
    await expect(page.getByRole("heading", { name: /Escolha a forma de pagamento/i })).toBeVisible()
    await runResponsiveChecks(page)
  })

  test("não oferece cartão quando só PIX está disponível", async ({ page }) => {
    await mockIntent(page, ["PIX"])
    await page.goto("/checkout/test-token")

    await expect(page.getByRole("heading", { name: /Pagamento via PIX/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /^PIX/ })).toBeVisible()
    await expect(page.getByText("Cartão de crédito")).toHaveCount(0)
    await runResponsiveChecks(page)
  })

  test("falha fechada: sem availableBillingTypes na resposta, o cartão não aparece", async ({ page }) => {
    await mockIntent(page)
    await page.goto("/checkout/test-token")

    await expect(page.getByRole("button", { name: /^PIX/ })).toBeVisible()
    await expect(page.getByText("Cartão de crédito")).toHaveCount(0)
  })

  test("oferece cartão somente quando o servidor o declara disponível", async ({ page }) => {
    await mockIntent(page, ["PIX", "CREDIT_CARD"])
    await page.goto("/checkout/test-token")

    await expect(page.getByRole("heading", { name: /Escolha a forma de pagamento/i })).toBeVisible()
    await expect(page.getByText("Cartão de crédito")).toBeVisible()
  })
})
