import { expect, test } from "@playwright/test"
import { runResponsiveChecks } from "../../../support/responsive"

test.describe("prévia local de providers de pagamento", () => {
  test("identifica os dados como simulados e não produtivos", async ({ page }) => {
    await page.goto("/ui-preview/payment-providers")

    await expect(page.getByRole("heading", { name: "Providers de pagamento" })).toBeVisible()
    await expect(page.getByRole("note", { name: "Prévia local" })).toContainText("Dados simulados")
    await expect(page.getByRole("note", { name: "Prévia local" })).toContainText(
      "não representa contas reais",
    )
  })

  test("mantém campos de desenvolvimento e produção independentes", async ({ page }) => {
    await page.goto("/ui-preview/payment-providers")
    await page
      .getByRole("button", { name: /Editar credenciais/ })
      .first()
      .click()

    const developmentApiKey = page.locator("#ABACATE_PAY-DEV-API_KEY")
    const productionApiKey = page.locator("#ABACATE_PAY-PRODUCTION-API_KEY")
    await developmentApiKey.fill("preview-dev-regression-check")
    await page
      .getByRole("tab", { name: /Produção/ })
      .first()
      .click()
    await expect(productionApiKey).toHaveValue("")
    await page
      .getByRole("tab", { name: /Desenvolvimento/ })
      .first()
      .click()
    await expect(developmentApiKey).toHaveValue("preview-dev-regression-check")
  })

  test("rejeita arquivo de logo fora dos formatos aceitos", async ({ page }) => {
    await page.goto("/ui-preview/payment-providers")
    await page
      .getByRole("button", { name: /Identificação da integração/ })
      .first()
      .click()
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "logo.gif",
        mimeType: "image/gif",
        buffer: Buffer.from("invalid image"),
      })

    await expect(page.getByText("Use uma imagem PNG, JPG ou WebP.", { exact: true })).toBeVisible()
  })

  test("responde a viewports mobile, touch targets e reduced motion", async ({ page }) => {
    await page.goto("/ui-preview/payment-providers")
    await expect(page.getByRole("heading", { name: "Providers de pagamento" })).toBeVisible()

    await runResponsiveChecks(page)
  })
})
